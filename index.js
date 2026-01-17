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

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(AppWithNavigation);
