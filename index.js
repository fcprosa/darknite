import { registerRootComponent } from 'expo';
import { NavigationContainer } from '@react-navigation/native';

import App from './App';
import { navigationRef } from './navigation/navigationService';

// Wrap App with NavigationContainer for React Navigation
const AppWithNavigation = () => (
  <NavigationContainer ref={navigationRef}>
    <App />
  </NavigationContainer>
);

registerRootComponent(AppWithNavigation);
