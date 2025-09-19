import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { http } from "../lib/http";

export interface UserInfo {
    id: string;
    name: string;
    profile_image_url?: string;
}

interface UsersStore {
    // State
    users: Map<string, UserInfo>;
    isLoading: boolean;

    // Actions
    setUsers: (users: UserInfo[]) => void;
    getUser: (userId: string) => UserInfo | undefined;
    fetchUsers: (userIds: string[]) => Promise<void>;
    getUserName: (userId: string) => string;
    clearUsers: () => void;
}

export const useUsersStore = create<UsersStore>()(
    devtools(
        (set, get) => ({
            // state
            users: new Map<string, UserInfo>(),
            isLoading: false,

            // Actions
            setUsers: (users: UserInfo[]) => {
                const userMap = new Map(get().users);
                users.forEach(user => {
                    userMap.set(user.id, user);
                });
                set({ users: userMap });
            },

            getUser: (userId: string) => {
                return get().users.get(userId);
            },

            fetchUsers: async (userIds: string[]) => {
                // 既にキャッシュされているユーザーを除外
                const cacheUsers = get().users;
                const missingUserIds = userIds.filter(id => !cacheUsers.has(id));

                if (missingUserIds.length === 0) return;

                set({ isLoading: true });

                try {
                    // バッチでユーザー情報を取得
                    const response = await http.postJSON<{ users: UserInfo[] }>(`/api/backend/users/batch`, {
                        user_ids: missingUserIds
                    });

                    if (response.users) {
                        get().setUsers(response.users);
                    }
                } catch (error) {
                    console.error('fetchUsersの処理に失敗しました：', error);
                    // エラー時は不明なユーザーとしてキャッシュ
                    const fallbackUsers = missingUserIds.map(id => ({
                        id,
                        name: 'Unknown User',
                    }));
                    get().setUsers(fallbackUsers);
                } finally {
                    set({ isLoading: false });
                }
            },

            getUserName: (userId: string) => {
                const user = get().getUser(userId);
                return user?.name || 'Unknown User';
            },

            clearUsers: () => {
                set({ users: new Map() });
            }
        }),
        { name: 'users-store' }
    )
);
