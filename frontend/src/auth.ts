import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'jwt_token';
export const USER_KEY = 'user_data';
export const ROLE_KEY = 'user_role';

export async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getRole(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ROLE_KEY);
  } catch {
    return null;
  }
}

export async function saveAuth(token: string, user: any): Promise<void> {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(ROLE_KEY, user?.role ?? 'manager');
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export async function clearAuth(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, ROLE_KEY]);
  } catch {}
}

export async function getUser(): Promise<any | null> {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}
