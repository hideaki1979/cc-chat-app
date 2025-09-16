package logging

import (
	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
)

// StructuredLogger 構造化ログ出力インターフェース
type StructuredLogger interface {
	// 基本ログメソッド
	Debug(message string, fields logrus.Fields)
	Info(message string, fields logrus.Fields)
	Warn(message string, fields logrus.Fields)
	Error(err error, message string, fields logrus.Fields)
	Fatal(err error, message string, fields logrus.Fields)

	// Echo Context専用メソッド
	DebugWithContext(c echo.Context, message string, fields logrus.Fields)
	InfoWithContext(c echo.Context, message string, fields logrus.Fields)
	WarnWithContext(c echo.Context, message string, fields logrus.Fields)
	ErrorWithContext(c echo.Context, err error, message string, fields logrus.Fields)
	FatalWithContext(c echo.Context, err error, message string, fields logrus.Fields)
}

// LogrusStructuredLogger logrus実装の構造化ログガー
type LogrusStructuredLogger struct {
	logger *logrus.Logger
}

// NewStructuredLogger 新しい構造化ログガーを作成
func NewStructuredLogger() StructuredLogger {
	logger := logrus.New()

	// JSON形式で出力
	logger.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: "2006-01-02T15:04:05.000Z07:00",
		FieldMap: logrus.FieldMap{
			logrus.FieldKeyTime:  "timestamp",
			logrus.FieldKeyLevel: "level",
			logrus.FieldKeyMsg:   "message",
		},
	})

	// 開発環境では全レベル、本番環境ではWarn以上
	logger.SetLevel(logrus.WarnLevel)

	return &LogrusStructuredLogger{
		logger: logger,
	}
}

// extractContextFields Echo Contextからログ用フィールドを抽出
func (l *LogrusStructuredLogger) extractContextFields(c echo.Context) logrus.Fields {
	fields := logrus.Fields{
		"method":    c.Request().Method,
		"path":      c.Request().URL.Path,
		"remote_ip": c.RealIP(),
	}

	// ユーザーIDがある場合は追加
	if userID, ok := c.Get("user_id").(string); ok && userID != "" {
		fields["user_id"] = userID
	}

	// リクエストIDがある場合は追加
	if requestID := c.Response().Header().Get(echo.HeaderXRequestID); requestID != "" {
		fields["request_id"] = requestID
	} else if requestID := c.Request().Header.Get(echo.HeaderXRequestID); requestID != "" {
		fields["request_id"] = requestID
	}

	// User-Agentも追加（デバッグ用）
	if userAgent := c.Request().UserAgent(); userAgent != "" {
		fields["user_agent"] = userAgent
	}

	return fields
}

// mergeFields フィールドをマージする
func (l *LogrusStructuredLogger) mergeFields(baseFields, additionalFields logrus.Fields) logrus.Fields {
	merged := make(logrus.Fields)

	// ベースフィールドをコピー
	for k, v := range baseFields {
		merged[k] = v
	}

	// 追加フィールドをマージ
	if additionalFields != nil {
		for k, v := range additionalFields {
			merged[k] = v
		}
	}

	return merged
}

// Debug デバッグレベルログ
func (l *LogrusStructuredLogger) Debug(message string, fields logrus.Fields) {
	l.logger.WithFields(fields).Debug(message)
}

// Info 情報レベルログ
func (l *LogrusStructuredLogger) Info(message string, fields logrus.Fields) {
	l.logger.WithFields(fields).Info(message)
}

// Warn 警告レベルログ
func (l *LogrusStructuredLogger) Warn(message string, fields logrus.Fields) {
	l.logger.WithFields(fields).Warn(message)
}

// Error エラーレベルログ
func (l *LogrusStructuredLogger) Error(err error, message string, fields logrus.Fields) {
	if fields == nil {
		fields = logrus.Fields{}
	}

	if err != nil {
		fields["error"] = err.Error()
		fields["error_type"] = err.Error() // エラー型情報
	}

	l.logger.WithFields(fields).Error(message)
}

// Fatal 致命的エラーレベルログ
func (l *LogrusStructuredLogger) Fatal(err error, message string, fields logrus.Fields) {
	if fields == nil {
		fields = logrus.Fields{}
	}

	if err != nil {
		fields["error"] = err.Error()
		fields["error_type"] = err.Error()
	}

	l.logger.WithFields(fields).Fatal(message)
}

// DebugWithContext Echo Context付きデバッグログ
func (l *LogrusStructuredLogger) DebugWithContext(c echo.Context, message string, fields logrus.Fields) {
	contextFields := l.extractContextFields(c)
	mergedFields := l.mergeFields(contextFields, fields)
	l.logger.WithFields(mergedFields).Debug(message)
}

// InfoWithContext Echo Context付き情報ログ
func (l *LogrusStructuredLogger) InfoWithContext(c echo.Context, message string, fields logrus.Fields) {
	contextFields := l.extractContextFields(c)
	mergedFields := l.mergeFields(contextFields, fields)
	l.logger.WithFields(mergedFields).Info(message)
}

// WarnWithContext Echo Context付き警告ログ
func (l *LogrusStructuredLogger) WarnWithContext(c echo.Context, message string, fields logrus.Fields) {
	contextFields := l.extractContextFields(c)
	mergedFields := l.mergeFields(contextFields, fields)
	l.logger.WithFields(mergedFields).Warn(message)
}

// ErrorWithContext Echo Context付きエラーログ
func (l *LogrusStructuredLogger) ErrorWithContext(c echo.Context, err error, message string, fields logrus.Fields) {
	contextFields := l.extractContextFields(c)

	if fields == nil {
		fields = logrus.Fields{}
	}

	if err != nil {
		fields["error"] = err.Error()
		fields["error_type"] = err.Error()
	}

	mergedFields := l.mergeFields(contextFields, fields)
	l.logger.WithFields(mergedFields).Error(message)
}

// FatalWithContext Echo Context付き致命的エラーログ
func (l *LogrusStructuredLogger) FatalWithContext(c echo.Context, err error, message string, fields logrus.Fields) {
	contextFields := l.extractContextFields(c)

	if fields == nil {
		fields = logrus.Fields{}
	}

	if err != nil {
		fields["error"] = err.Error()
		fields["error_type"] = err.Error()
	}

	mergedFields := l.mergeFields(contextFields, fields)
	l.logger.WithFields(mergedFields).Fatal(message)
}