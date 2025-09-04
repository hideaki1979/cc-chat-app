export interface UserSearchResult {
    id: string;
    name: string;
    email: string;
    profile_image_url?: string;
}

export interface UserSearchResponse {
    users: UserSearchResult[];
    total: number;
}
