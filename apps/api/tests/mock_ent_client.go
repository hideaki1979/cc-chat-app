package tests

import (
	"github.com/hideaki1979/cc-chat-app/apps/api/ent"
)

// CreateMockEntClient creates a basic ent.Client that can be used in tests
// Note: This is a simplified mock for basic testing scenarios
// For complex DB operations, use the SetupTestDB function with SQLite instead
func CreateMockEntClient() *ent.Client {
	// Return a basic ent.Client instance
	// For proper testing, use SetupTestDB with SQLite
	return &ent.Client{}
}