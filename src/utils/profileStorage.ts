import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_NAME_KEY = '@inspectify_profile_name';
const PROFILE_ROLE_KEY = '@inspectify_profile_role';

const DEFAULT_PROFILE_NAME = 'Ishant Sharma';
const DEFAULT_PROFILE_ROLE = 'Quality Assurance Lead';

export interface UserProfile {
  name: string;
  role: string;
}

export async function getProfileData(): Promise<UserProfile> {
  try {
    const savedName = await AsyncStorage.getItem(PROFILE_NAME_KEY);
    const savedRole = await AsyncStorage.getItem(PROFILE_ROLE_KEY);
    return {
      name: savedName && savedName.trim() ? savedName.trim() : DEFAULT_PROFILE_NAME,
      role: savedRole && savedRole.trim() ? savedRole.trim() : DEFAULT_PROFILE_ROLE,
    };
  } catch (error) {
    console.warn('Error reading profile from AsyncStorage:', error);
    return {
      name: DEFAULT_PROFILE_NAME,
      role: DEFAULT_PROFILE_ROLE,
    };
  }
}

export async function saveProfileData(name: string, role?: string): Promise<void> {
  try {
    if (name !== undefined) {
      await AsyncStorage.setItem(PROFILE_NAME_KEY, name.trim());
    }
    if (role !== undefined) {
      await AsyncStorage.setItem(PROFILE_ROLE_KEY, role.trim());
    }
  } catch (error) {
    console.error('Error saving profile to AsyncStorage:', error);
  }
}
