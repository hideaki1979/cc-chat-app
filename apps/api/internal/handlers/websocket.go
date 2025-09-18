package handlers

import (
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/websocket"
	"github.com/labstack/echo/v4"
)

// WebSocketHandler WebSocket関連のハンドラー
type WebSocketHandler struct {
	hub *websocket.Hub
}

// NewWebSocketHandler 新しいWebSocketハンドラーを作成
func NewWebSocketHandler(hub *websocket.Hub) *WebSocketHandler {
	return &WebSocketHandler{
		hub: hub,
	}
}

// HandleWebSocket WebSocket接続を処理する
func (h *WebSocketHandler) HandleWebSocket(c echo.Context) error {
	return websocket.ServeWS(h.hub, c)
}