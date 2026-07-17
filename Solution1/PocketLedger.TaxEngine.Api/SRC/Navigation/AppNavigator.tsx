// ============================================================
//  AppNavigator.tsx — Updated with all 6 screens
// ============================================================

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator }     from "@react-navigation/stack";
import { NavigationContainer }      from "@react-navigation/native";
import { Text }                     from "react-native";

import DashboardScreen       from "../screens/DashboardScreen";
import TransactionsScreen    from "../screens/TransactionsScreen";
import AddTransactionScreen  from "../screens/AddTransactionScreen";
import StatementsScreen      from "../screens/StatementsScreen";
import AuditFlagsScreen      from "../screens/AuditFlagsScreen";
import TaxCalculatorScreen   from "../screens/TaxCalculatorScreen";

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack for the Transactions tab (list + add)
function TransactionsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: "Transactions" }} />
      <Stack.Screen name="AddTransaction" component={AddTransactionScreen} options={{ title: "Add Transaction" }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => {
            const icons: Record<string, string> = {
              Dashboard:   "🏠",
              Transactions: "💳",
              Upload:      "📄",
              AuditFlags:  "🚩",
              TaxCalc:     "🧮",
            };
            return <Text style={{ fontSize: focused ? 22 : 18 }}>{icons[route.name]}</Text>;
          },
          tabBarActiveTintColor:   "#007AFF",
          tabBarInactiveTintColor: "gray",
          headerStyle:             { backgroundColor: "#f8f9fa" },
          headerTitleAlign:        "center",
          tabBarStyle:             { paddingBottom: 5, height: 60 },
        })}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: "Home" }}
        />
        <Tab.Screen
          name="Transactions"
          component={TransactionsStack}
          options={{ title: "Transactions", headerShown: false }}
        />
        <Tab.Screen
          name="Upload"
          component={StatementsScreen}
          options={{ title: "Upload" }}
        />
        <Tab.Screen
          name="AuditFlags"
          component={AuditFlagsScreen}
          options={{ title: "Flags" }}
        />
        <Tab.Screen
          name="TaxCalc"
          component={TaxCalculatorScreen}
          options={{ title: "Tax Calc" }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
