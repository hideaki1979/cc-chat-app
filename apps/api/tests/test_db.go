package tests

import (
	"context"
	"database/sql"
	"testing"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"
	"github.com/google/uuid"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
	"github.com/hideaki1979/cc-chat-app/apps/api/ent/migrate"
	"github.com/labstack/echo/v4"
	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/require"
)

// SetupTestDB creates an in-memory SQLite database for testing
func SetupTestDB(t *testing.T) (*ent.Client, func()) {
	// Create in-memory SQLite database with foreign keys enabled
	db, err := sql.Open("sqlite3", ":memory:?_fk=1")
	require.NoError(t, err)

	// Create ent client
	drv := entsql.OpenDB(dialect.SQLite, db)
	client := ent.NewClient(ent.Driver(drv))

	// Run migrations
	ctx := context.Background()
	err = client.Schema.Create(
		ctx,
		migrate.WithDropIndex(true),
		migrate.WithDropColumn(true),
	)
	require.NoError(t, err)

	// Cleanup function
	cleanup := func() {
		client.Close()
		db.Close()
	}

	return client, cleanup
}

// CreateTestUser creates a test user in the database
func CreateTestUser(t *testing.T, client *ent.Client, email, name string) *ent.User {
	ctx := context.Background()
	user, err := client.User.
		Create().
		SetEmail(email).
		SetName(name).
		SetPasswordHash([]byte("test-hash")).
		Save(ctx)
	require.NoError(t, err)
	return user
}

// SetupTestContext sets up authentication and database context for testing
func SetupTestContext(t *testing.T, c echo.Context, userID string) (*ent.Client, func()) {
	if userID != "" {
		c.Set("user_id", userID)
	}

	client, cleanup := SetupTestDB(t)
	c.Set("db", client)

	return client, cleanup
}

// SetupTestContextWithRandomUser sets up authentication context with a random user ID and database
func SetupTestContextWithRandomUser(t *testing.T, c echo.Context) (*ent.Client, func()) {
	userID := uuid.New().String()
	return SetupTestContext(t, c, userID)
}