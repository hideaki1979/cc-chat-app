package services

import (
	"context"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Config S3設定
type S3Config struct {
	Region       string
	Bucket       string
	AccessKey    string
	SecretKey    string
	SessionToken string
}

// NewS3Config 環境変数からS3設定を作成
func NewS3Config() *S3Config {
	return &S3Config{
		Region:       getEnv("AWS_REGION", "ap-northeast-1"),
		Bucket:       getEnv("AWS_S3_BUCKET", ""),
		AccessKey:    getEnv("AWS_ACCESS_KEY_ID", ""),
		SecretKey:    getEnv("AWS_SECRET_ACCESS_KEY", ""),
		SessionToken: getEnv("AWS_SESSION_TOKEN", ""),
	}
}

// NewS3Client S3クライアントを作成
func NewS3Client(ctx context.Context, s3Config *S3Config) (*s3.Client, error) {
	opts := []func(*config.LoadOptions) error{
		config.WithRegion(s3Config.Region),
	}

	// 明示的に指定された場合のみ固定クレデンシャルを使用し、未指定時はデフォルトチェイン(環境変数/共有設定/ロール)に委譲
	if s3Config.AccessKey != "" && s3Config.SecretKey != "" {
		opts = append(opts, config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(
				s3Config.AccessKey, s3Config.SecretKey, s3Config.SessionToken,
			),
		))
	}

	cfg, err := config.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, err
	}

	// 開発用途のS3互換エンドポイントに対応 (例: MINIO/LocalStack)
	var s3Opts []func(*s3.Options)
	if endpoint := getEnv("AWS_S3_ENDPOINT", ""); endpoint != "" {
		s3Opts = append(s3Opts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(endpoint)
			o.UsePathStyle = true
		})
	}
	return s3.NewFromConfig(cfg, s3Opts...), nil
}

// getEnv 環境変数取得のヘルパー関数
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
