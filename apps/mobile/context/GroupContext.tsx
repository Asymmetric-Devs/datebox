import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGetGroupsMe } from '@elepad/api-client/src/gen/client';
import { useAuth } from '@/hooks/useAuth';

const AsyncStorageKey = 'SELECTED_GROUP_ID';

interface Group {
  id: string;
  name: string;
  role: string | null;
}

interface GroupContextType {
  selectedGroupId: string | null;
  selectedGroup: Group | null;
  availableGroups: Group[];
  setSelectedGroupId: (id: string) => Promise<void>;
  isLoading: boolean;
  refreshGroups: () => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export const GroupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [selectedGroupId, _setSelectedGroupId] = useState<string | null>(null);
  const { data: response, isLoading, refetch } = useGetGroupsMe({
    query: {
      enabled: !!user,
    },
  });

  // Extract the actual groups array from the response
  const groups = (response && 'data' in response && Array.isArray(response.data)) ? response.data : null;

  // Load persisted selection on mount
  useEffect(() => {
    const loadPersistedGroup = async () => {
      try {
        const storedId = await AsyncStorage.getItem(AsyncStorageKey);
        if (storedId) {
          _setSelectedGroupId(storedId);
        }
      } catch (e) {
        console.error('Failed to load selected group from storage', e);
      }
    };
    loadPersistedGroup();
  }, []);

  // Sync selection with available groups
  useEffect(() => {
    if (!isLoading && groups && groups.length > 0) {
      if (!selectedGroupId || !groups.find(g => g.id === selectedGroupId)) {
        // Default to the first group if nothing is selected or current selection is invalid
        const firstGroupId = groups[0].id;
        _setSelectedGroupId(firstGroupId);
        AsyncStorage.setItem(AsyncStorageKey, firstGroupId);
      }
    } else if (!isLoading && (!groups || groups.length === 0)) {
       _setSelectedGroupId(null);
    }
  }, [groups, isLoading, selectedGroupId]);

  const setSelectedGroupId = useCallback(async (id: string) => {
    _setSelectedGroupId(id);
    await AsyncStorage.setItem(AsyncStorageKey, id);
  }, []);

  const selectedGroup = groups?.find(g => g.id === selectedGroupId) || null;

  return (
    <GroupContext.Provider
      value={{
        selectedGroupId,
        selectedGroup,
        availableGroups: groups || [],
        setSelectedGroupId,
        isLoading,
        refreshGroups: refetch
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};

export const useGroup = () => {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useGroup must be used within a GroupProvider');
  }
  return context;
};
