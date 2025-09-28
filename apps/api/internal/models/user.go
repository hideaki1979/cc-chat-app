package models

// ユーザーバッチ取得用のリクエスト構造体
type BatchGetUsersRequest struct {
	UserIDs []string `json:"user_ids" validate:"required,max=50,dive,uuid4"`
}

// ユーザーバッチ取得レスポンス構造体
type BatchGetUsersResponse struct {
	Users []UserSearchResult `json:"users"`
}

// ユーザー基本情報（バッチ取得用）
type UserBasicInfo struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	ProfileImageURL *string `json:"profile_image_url,omitempty"`
}