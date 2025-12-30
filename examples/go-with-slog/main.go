package main

import (
	"errors"
	"log/slog"
	"os"
	"runtime/debug"
	"time"
)

func main() {
	// Configure slog to output JSON to stdout
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	slog.SetDefault(logger)

	// Basic logging at different levels
	slog.Debug("Debugging slog!", "ev", "app_start")
	slog.Info("Hello, slog!", "ev", "app_start")
	slog.Warn("Warning from slog!", "ev", "app_start")
	slog.Error("Error in slog!", "ev", "app_start")

	// Logging with structured fields
	slog.Info("User logged in",
		"user_id", 12345,
		"username", "john_doe",
		"ip_address", "192.168.1.1")

	// Grouped logs with operation_id
	loggerWithOp := slog.With("operation_id", "abcde")
	loggerWithOp.Debug("Starting operation", "step", 1)
	loggerWithOp.Info("Processing data", "step", 2, "records", 100)
	loggerWithOp.Info("Operation halfway", "step", 3, "progress", 50)
	loggerWithOp.Warn("Slow performance detected", "step", 4, "latency_ms", 250)
	loggerWithOp.Info("Operation complete", "step", 5, "duration_ms", 1200)

	// Nested error handling (always include stack)
	if err := performOperation(); err != nil {
		slog.Error("Operation failed",
			"error", err.Error(),
			"stack", string(debug.Stack()),
			"ev", "operation_error")
	}

	// Stacktrace example (always include stack)
	err := errors.New("sample error for stacktrace")
	slog.Error("An error occurred with stacktrace",
		"error", err.Error(),
		"stack", string(debug.Stack()),
		"ev", "stacktrace_example")

	// Continuous logging loop
	counter := 0
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		counter++
		slog.Info("Main loop iteration",
			"ev", "main_loop",
			"iteration", counter,
			"timestamp", time.Now().Unix())

		if counter >= 20 {
			slog.Info("Stopping after 20 iterations", "ev", "app_shutdown")
			break
		}
	}
}

func performOperation() error {
	if err := level1(); err != nil {
		return err
	}
	return nil
}

func level1() error {
	if err := level2(); err != nil {
		return errors.New("level1 failed: " + err.Error())
	}
	return nil
}

func level2() error {
	if err := level3(); err != nil {
		return errors.New("level2 failed: " + err.Error())
	}
	return nil
}

func level3() error {
	return errors.New("innermost error occurred")
}
