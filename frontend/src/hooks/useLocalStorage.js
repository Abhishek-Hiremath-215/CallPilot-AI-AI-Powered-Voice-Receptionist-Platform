import { useState, useEffect } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/storage';

export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    const item = loadFromStorage(key);
    return item !== null ? item : initialValue;
  });

  useEffect(() => {
    saveToStorage(key, storedValue);
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};
