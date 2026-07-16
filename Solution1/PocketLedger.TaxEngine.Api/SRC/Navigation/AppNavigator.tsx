import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";

// Import your screen files
import AddTransactionScreen from "../screens/AddTransactionScreen";
import StatementsScreen from "../screens/StatementsScreen";

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: "#007AFF",
          tabBarInactiveTintColor: "gray",
          headerStyle: { backgroundColor: "#f8f9fa" },
          headerTitleAlign: "center",
        }}
      >
        <Tab.Screen 
          name="Manual Entry" 
          component={AddTransactionScreen} 
          options={{ title: "Add Transaction" }}
        />
        <Tab.Screen 
          name="Upload Statement" 
          component={StatementsScreen} 
          options={{ title: "Upload PDF/CSV" }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}