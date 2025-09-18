package websocket_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/hideaki1979/cc-chat-app/apps/api/internal/handlers"
	"github.com/hideaki1979/cc-chat-app/apps/api/internal/websocket"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
)

func TestWebSocketHandler_HandleWebSocket(t *testing.T) {
	// Hubを作成
	hub := websocket.NewHub()
	go hub.Run()

	handler := handlers.NewWebSocketHandler(hub)

	tests := []struct {
		name           string
		setupContext   func(c echo.Context)
		expectedStatus int
		expectError    bool
	}{
		{
			name: "ユーザーIDなしでのWebSocket接続",
			setupContext: func(c echo.Context) {
				// user_idを設定しない
			},
			expectedStatus: http.StatusUnauthorized,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			tt.setupContext(c)

			err := handler.HandleWebSocket(c)
			if tt.expectError {
				assert.Error(t, err)
				if echoErr, ok := err.(*echo.HTTPError); ok {
					assert.Equal(t, tt.expectedStatus, echoErr.Code)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestNewWebSocketHandler(t *testing.T) {
	hub := websocket.NewHub()
	handler := handlers.NewWebSocketHandler(hub)

	assert.NotNil(t, handler)
}