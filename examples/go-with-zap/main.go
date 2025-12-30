package main

import (
	"fmt"
	"os"
	"time"

	"github.com/pkg/errors"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var StackTraceExampleErorr = errors.New("stack trace inner example error")

func main() {
	cfg := zap.Config{
		Level:       zap.NewAtomicLevelAt(zap.DebugLevel),
		Development: false,
		Encoding:    "json",
		EncoderConfig: zapcore.EncoderConfig{
			TimeKey:        "timestamp",
			LevelKey:       "level",
			NameKey:        "logger",
			CallerKey:      "caller",
			MessageKey:     "msg",
			StacktraceKey:  "stacktrace",
			LineEnding:     zapcore.DefaultLineEnding,
			EncodeLevel:    zapcore.LowercaseLevelEncoder,
			EncodeTime:     zapcore.EpochTimeEncoder,
			EncodeDuration: zapcore.SecondsDurationEncoder,
			EncodeCaller:   zapcore.ShortCallerEncoder,
		},
		OutputPaths:      []string{"stdout"},
		ErrorOutputPaths: []string{"stderr"},
	}

	logger, err := cfg.Build()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to build logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	// Basic logging at different levels
	logger.Debug("Debugging zap!", zap.String("ev", "app_start"))
	logger.Info("Hello, zap!", zap.String("ev", "app_start"))
	logger.Warn("Warning from zap!", zap.String("ev", "app_start"))
	logger.Error("Error in zap!", zap.String("ev", "app_start"))

	// Logging with structured fields
	logger.Info("User logged in",
		zap.Int("user_id", 12345),
		zap.String("username", "john_doe"),
		zap.String("ip_address", "192.168.1.1"),
	)

	// Grouped logs with operation_id
	loggerWithOp := logger.With(zap.String("operation_id", "abcde"))
	loggerWithOp.Debug("Starting operation", zap.Int("step", 1))
	loggerWithOp.Info("Processing data", zap.Int("step", 2), zap.Int("records", 100))
	loggerWithOp.Info("Operation halfway", zap.Int("step", 3), zap.Int("progress", 50))
	loggerWithOp.Warn("Slow performance detected", zap.Int("step", 4), zap.Int("latency_ms", 250))
	loggerWithOp.Info("Operation complete", zap.Int("step", 5), zap.Int("duration_ms", 1200))

	// Nested error handling (show innermost stack captured at error creation)
	if err := performOperation(); err != nil {
		logger.Error("Operation failed",
			zap.String("error", err.Error()),
			zap.String("ev", "operation_error"),
		)
	}

	// Deep error logging handled at depth
	deepErrorLogHandled(logger, 5)

	// Continuous logging loop
	counter := 0
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		counter++
		logger.Info("Main loop iteration",
			zap.String("ev", "main_loop"),
			zap.Int("iteration", counter),
			zap.Int64("timestamp", time.Now().Unix()),
		)

		if counter >= 20 {
			logger.Info("Stopping after 20 iterations", zap.String("ev", "app_shutdown"))
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
		return errors.Wrap(err, "level1 failed")
	}
	return nil
}

func level2() error {
	if err := level3(); err != nil {
		return errors.Wrap(err, "level2 failed")
	}
	return nil
}

func level3() error {
	return StackTraceExampleErorr
}

func deepErrorLogHandled(logger *zap.Logger, depth int) {
	if depth <= 0 {
		logger.Error("Deep error occurred",
			zap.String("error", StackTraceExampleErorr.Error()),
			zap.String("ev", "deep_error"),
		)
		return
	}

	deepErrorLogHandled(logger, depth-1)
}
