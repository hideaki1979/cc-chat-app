import { useEffect } from "react";
import { useUsersStore } from "../stores/users"

export const useUserResolver = (userIds: string[]) => {
    const { fetchUsers, getUserName, getUser } = useUsersStore();

    // ユーザーIDが変更された時にユーザー情報を取得
    useEffect(() => {
        const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
        if (uniqueUserIds.length > 0) {
            fetchUsers(uniqueUserIds);
        }
    }, [userIds, fetchUsers]);

    return {
        getUserName,
        getUser,
    };
};
