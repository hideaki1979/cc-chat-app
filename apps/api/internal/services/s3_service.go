package services

import (
	"context"
	"os"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Config S3設定
type S3Config struct {
	Region    string
	Bucket    string
	AccessKey string
	SecretKey string
}

// NewS3Config 環境変数からS3設定を作成
func NewS3Config() *S3Config {
	return &S3Config{
		Region:    getEnv("AWS_REGION", "ap-northeast-1"),
		Bucket:    getEnv("AWS_S3_BUCKET", ""),
		AccessKey: getEnv("AWS_ACCESS_KEY_ID", ""),
		SecretKey: getEnv("AWS_SECRET_ACCESS_KEY", ""),
	}
}

// NewS3Client S3クライアントを作成
func NewS3Client(ctx context.Context, s3Config *S3Config) (*s3.Client, error) {
	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion(s3Config.Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			s3Config.AccessKey,
			s3Config.SecretKey,
			"",
		)),
	)
	if err != nil {
		return nil, err
	}

	return s3.NewFromConfig(cfg), nil
}

// getEnv 環境変数取得のヘルパー関数
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}