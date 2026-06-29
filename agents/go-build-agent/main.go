// Wall-E Go Sub-Agent — Fast File System & Build Operations
// Handles bulk file ops, concurrent build pipelines, and system monitoring.
// Runs as an A2A-compatible HTTP service on port 8002.
//
// Run: adk run --port 8002

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/vertexai/apiv1beta1/vertexaipb"
	"github.com/google/adk-go/adk"
)

var projectRoot = func() string {
	if root := os.Getenv("WALL_E_PROJECT_ROOT"); root != "" {
		return root
	}
	wd, _ := os.Getwd()
	return wd
}()

// ─── Tools ───────────────────────────────────────────────────────────────────

// FindFiles searches for files matching a glob pattern concurrently.
// Faster than shell find for large trees.
func FindFiles(pattern string, root string) (map[string]interface{}, error) {
	if root == "" {
		root = projectRoot
	}
	var mu sync.Mutex
	var matches []string

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable dirs
		}
		// Skip noise directories
		if d.IsDir() && (d.Name() == "node_modules" || d.Name() == ".git" ||
			d.Name() == "__pycache__" || d.Name() == ".venv") {
			return filepath.SkipDir
		}
		matched, _ := filepath.Match(pattern, d.Name())
		if matched {
			mu.Lock()
			matches = append(matches, path)
			mu.Unlock()
		}
		return nil
	})

	if err != nil {
		return map[string]interface{}{"error": err.Error()}, nil
	}
	return map[string]interface{}{"matches": matches, "count": len(matches)}, nil
}

// RunBuildStep runs a single build command with a timeout.
func RunBuildStep(command string, cwd string, timeoutSeconds int) (map[string]interface{}, error) {
	if cwd == "" {
		cwd = projectRoot
	}
	if timeoutSeconds <= 0 {
		timeoutSeconds = 120
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "sh", "-c", command)
	cmd.Dir = cwd
	out, err := cmd.CombinedOutput()

	result := map[string]interface{}{
		"command": command,
		"output":  string(out),
		"success": err == nil,
	}
	if err != nil {
		result["error"] = err.Error()
	}
	return result, nil
}

// RunParallelBuilds runs multiple build commands concurrently.
// Useful for building multiple packages simultaneously.
func RunParallelBuilds(commands []string, cwd string) (map[string]interface{}, error) {
	if cwd == "" {
		cwd = projectRoot
	}

	type result struct {
		Command string      `json:"command"`
		Output  string      `json:"output"`
		Success bool        `json:"success"`
		Error   string      `json:"error,omitempty"`
	}

	results := make([]result, len(commands))
	var wg sync.WaitGroup

	for i, cmd := range commands {
		wg.Add(1)
		go func(idx int, command string) {
			defer wg.Done()
			res, _ := RunBuildStep(command, cwd, 120)
			out, _ := res["output"].(string)
			errStr, _ := res["error"].(string)
			results[idx] = result{
				Command: command,
				Output:  out,
				Success: res["success"].(bool),
				Error:   errStr,
			}
		}(i, cmd)
	}

	wg.Wait()

	allPassed := true
	for _, r := range results {
		if !r.Success {
			allPassed = false
			break
		}
	}

	return map[string]interface{}{
		"results":    results,
		"all_passed": allPassed,
	}, nil
}

// CountLines counts lines of code across files matching a glob.
func CountLines(pattern string, root string) (map[string]interface{}, error) {
	if root == "" {
		root = projectRoot
	}

	type fileCount struct {
		Path  string `json:"path"`
		Lines int    `json:"lines"`
	}

	var counts []fileCount
	total := 0

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			if d != nil && d.IsDir() && (d.Name() == "node_modules" || d.Name() == ".git") {
				return filepath.SkipDir
			}
			return nil
		}
		matched, _ := filepath.Match(pattern, d.Name())
		if !matched {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		lines := strings.Count(string(data), "\n") + 1
		counts = append(counts, fileCount{Path: path, Lines: lines})
		total += lines
		return nil
	})

	if err != nil {
		return map[string]interface{}{"error": err.Error()}, nil
	}

	return map[string]interface{}{
		"files":       counts,
		"total_lines": total,
		"file_count":  len(counts),
	}, nil
}

// DiskUsage returns disk usage for a directory.
func DiskUsage(path string) (map[string]interface{}, error) {
	if path == "" {
		path = projectRoot
	}
	cmd := exec.Command("du", "-sh", path)
	out, err := cmd.Output()
	if err != nil {
		return map[string]interface{}{"error": err.Error()}, nil
	}
	parts := strings.Fields(string(out))
	size := ""
	if len(parts) > 0 {
		size = parts[0]
	}
	return map[string]interface{}{"size": size, "path": path}, nil
}

// ─── Agent ────────────────────────────────────────────────────────────────────

func main() {
	agent := adk.NewLlmAgent(adk.LlmAgentConfig{
		Name:        "go_build_agent",
		Model:       "gemini-flash-latest",
		Description: "Handles performance-critical tasks: bulk file operations, parallel build pipelines, disk usage analysis, and line counting across large codebases.",
		Instruction: `
You are Wall-E's Go sub-agent, specialized in fast, concurrent system operations.

Your responsibilities:
- Find files matching patterns across large directory trees (FindFiles)
- Run individual build steps with timeout control (RunBuildStep)
- Run multiple build commands in parallel (RunParallelBuilds)
- Count lines of code across a codebase (CountLines)
- Report disk usage (DiskUsage)

Be concise and structured in your responses. Return JSON-friendly data
that the Python orchestrator can act on directly.
		`,
		Tools: []adk.Tool{
			adk.FunctionTool(FindFiles),
			adk.FunctionTool(RunBuildStep),
			adk.FunctionTool(RunParallelBuilds),
			adk.FunctionTool(CountLines),
			adk.FunctionTool(DiskUsage),
		},
	})

	fmt.Println("Wall-E Go sub-agent starting on :8002")
	if err := adk.ServeA2A(agent, ":8002"); err != nil {
		fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
		os.Exit(1)
	}
}
