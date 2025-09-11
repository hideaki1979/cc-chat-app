'use client';

type Theme = 'light' | 'dark' | 'system';

/**
 * テーマ設定をCookieで管理するユーティリティ
 * TASK-002: localStorage依存を排除し、Cookieベースに変更
 */
export class ThemeCookieManager {
  private static readonly THEME_COOKIE_NAME = 'theme-preference';
  private static readonly COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1年

  /**
   * Cookieからテーマ設定を取得
   */
  static getTheme(): Theme | null {
    if (typeof document === 'undefined') return null;
    
    try {
      const cookies = document.cookie.split(';');
      const themeCookie = cookies.find(cookie => 
        cookie.trim().startsWith(`${this.THEME_COOKIE_NAME}=`)
      );
      
      if (!themeCookie) return null;
      
      const theme = themeCookie.split('=')[1]?.trim() as Theme;
      return ['light', 'dark', 'system'].includes(theme) ? theme : null;
    } catch (error) {
      console.warn('Failed to get theme from cookie:', error);
      return null;
    }
  }

  /**
   * テーマ設定をCookieに保存
   */
  static setTheme(theme: Theme): void {
    if (typeof document === 'undefined') return;
    
    try {
      const cookieValue = `${this.THEME_COOKIE_NAME}=${theme}; max-age=${this.COOKIE_MAX_AGE}; path=/; SameSite=Strict`;
      document.cookie = cookieValue;
    } catch (error) {
      console.warn('Failed to set theme cookie:', error);
    }
  }

  /**
   * テーマCookieを削除
   */
  static removeTheme(): void {
    if (typeof document === 'undefined') return;
    
    try {
      document.cookie = `${this.THEME_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    } catch (error) {
      console.warn('Failed to remove theme cookie:', error);
    }
  }
}