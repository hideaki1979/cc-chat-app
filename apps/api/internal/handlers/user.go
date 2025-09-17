package handlers

import (
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/user"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/middleware"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/models"

	"github.com/labstack/echo/v4"
	"github.com/sirupsen/logrus"
)

// UserHandler ユーザー操作専用のハンドラー構造体
type UserHandler struct {
	*BaseHandler
}

// NewUserHandler 新しいUserHandlerインスタンスを作成
func NewUserHandler() *UserHandler {
	return &UserHandler{
		BaseHandler: NewBaseHandler(),
	}
}

// SearchUsers ユーザー検索ハンドラー（JWT認証が必要）
func (h *UserHandler) SearchUsers(c echo.Context) error {
	// 認証チェック
	_, err := h.getUserID(c)
	if err != nil {
		return h.handleError(c, err)
	}

	var req models.UserSearchRequest
	if err := middleware.ValidateRequest(c, &req); err != nil {
		return h.handleError(c, err)
	}

	// デフォルトのlimit設定
	if req.Limit == 0 {
		req.Limit = 10
	}

	client, err := h.getDBClient(c)
	if err != nil {
		return h.handleError(c, err)
	}
	ctx := c.Request().Context()

	// 総件数を取得
	total, err := client.User.Query().
		Where(
			user.Or(
				user.NameContainsFold(req.Query),
				user.EmailContainsFold(req.Query),
			),
		).Count(ctx)

	if err != nil {
		h.logError(c, err, "Failed to count users during search", logrus.Fields{
			"operation":    "search_users",
			"search_query": req.Query,
			"limit":        req.Limit,
		})
		return h.handleError(c, err)
	}

	// 実際の検索結果を取得
	users, err := client.User.Query().
		Where(
			user.Or(
				user.NameContainsFold(req.Query),
				user.EmailContainsFold(req.Query),
			),
		).
		Limit(req.Limit).
		All(ctx)

	if err != nil {
		h.logError(c, err, "Failed to execute user search query", logrus.Fields{
			"operation":    "search_users",
			"search_query": req.Query,
			"limit":        req.Limit,
			"total_count":  total,
		})
		return h.handleError(c, err)
	}

	// レスポンス作成
	searchResults := make([]models.UserSearchResult, len(users))
	for i, user := range users {
		searchResults[i] = models.UserSearchResult{
			ID:              user.ID.String(),
			Name:            user.Name,
			Email:           user.Email,
			ProfileImageURL: user.ProfileImageURL,
		}
	}

	response := models.UserSearchResponse{
		Users: searchResults,
		Total: total,
	}

	return c.JSON(200, response)
}
