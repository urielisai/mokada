import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../../layouts/AppLayout';
import { AdminRoute } from '../../modules/auth/components/AdminRoute';
import { ProtectedRoute } from '../../modules/auth/components/ProtectedRoute';
import { ChangePasswordPage } from '../../modules/auth/pages/ChangePasswordPage';
import { LoginPage } from '../../modules/auth/pages/LoginPage';
import { ProfilePage } from '../../modules/auth/pages/ProfilePage';

import { DashboardPage } from '../../modules/dashboard/pages/DashboardPage';
import { ProductsPage } from '../../modules/catalog/pages/ProductsPage';
import { ProductFormPage } from '../../modules/catalog/pages/ProductFormPage';
import { CategoriesPage } from '../../modules/catalog/pages/CategoriesPage';
import { BrandsPage } from '../../modules/catalog/pages/BrandsPage';
import { VehiclesPage } from '../../modules/catalog/pages/VehiclesPage';

import { StockPage } from '../../modules/inventory/pages/StockPage';
import { MovementsPage } from '../../modules/inventory/pages/MovementsPage';
import { WarehousesPage } from '../../modules/inventory/pages/WarehousesPage';
import { TransfersPage } from '../../modules/inventory/pages/TransfersPage';
import { TransferFormPage } from '../../modules/inventory/pages/TransferFormPage';
import { TransferDetailPage } from '../../modules/inventory/pages/TransferDetailPage';
import { CustomersPage } from '../../modules/customers/pages/CustomersPage';
import { CustomerFormPage } from '../../modules/customers/pages/CustomerFormPage';

import { UnitsPage } from '../../modules/configuration/pages/UnitsPage';
import { PriceListsPage } from '../../modules/configuration/pages/PriceListsPage';
import { AttributesPage } from '../../modules/configuration/pages/AttributesPage';
import { ConfigurationPage } from '../../modules/configuration/pages/ConfigurationPage';
import { UsersPage } from '../../modules/admin/users/pages/UsersPage';

import { FleetVehiclesPage } from '../../modules/fleet/pages/FleetVehiclesPage';
import { VehicleExpensesPage } from '../../modules/fleet/pages/VehicleExpensesPage';
import { VehicleExpenseFormPage } from '../../modules/fleet/pages/VehicleExpenseFormPage';
import { RouteOpsDashboardPage } from '../../modules/route-operations/pages/RouteOpsDashboardPage';
import { RoutesPage } from '../../modules/route-operations/pages/RoutesPage';
import { RouteFormPage } from '../../modules/route-operations/pages/RouteFormPage';
import { RouteTripsPage } from '../../modules/route-operations/pages/RouteTripsPage';
import { TripDetailPage } from '../../modules/route-operations/pages/TripDetailPage';
import { MyRoutePage } from '../../modules/route-operations/pages/MyRoutePage';
import { SettlementsPage } from '../../modules/route-operations/pages/SettlementsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />
          },
          {
            path: 'account',
            children: [
              { path: 'profile', element: <ProfilePage /> },
              { path: 'password', element: <ChangePasswordPage /> },
            ]
          },
          {
            path: 'catalog',
            children: [
              { path: 'products', element: <ProductsPage /> },
              { path: 'products/new', element: <ProductFormPage /> },
              { path: 'products/:id', element: <ProductFormPage /> },
              { path: 'categories', element: <CategoriesPage /> },
              { path: 'brands', element: <BrandsPage /> },
              { path: 'vehicles', element: <VehiclesPage /> },
            ]
          },
          {
            path: 'customers',
            children: [
              { index: true, element: <CustomersPage /> },
              { path: 'new', element: <CustomerFormPage /> },
              { path: ':id', element: <CustomerFormPage /> },
            ]
          },
          {
            path: 'inventory',
            children: [
              { path: 'stock', element: <StockPage /> },
              { path: 'movements', element: <MovementsPage /> },
              { path: 'warehouses', element: <WarehousesPage /> },
              { path: 'transfers', element: <TransfersPage /> },
              { path: 'transfers/new', element: <TransferFormPage /> },
              { path: 'transfers/:id', element: <TransferDetailPage /> },
              { path: 'transfers/edit/:id', element: <TransferFormPage /> },
            ]
          },
          {
            path: 'fleet',
            children: [
              { path: 'vehicles', element: <FleetVehiclesPage /> },
              { path: 'expenses', element: <VehicleExpensesPage /> },
              { path: 'expenses/new', element: <VehicleExpenseFormPage /> },
              { path: 'expenses/:id', element: <VehicleExpenseFormPage /> },
            ]
          },
          {
            path: 'route-operations',
            children: [
              { path: 'dashboard', element: <RouteOpsDashboardPage /> },
              { path: 'routes', element: <RoutesPage /> },
              { path: 'routes/new', element: <RouteFormPage /> },
              { path: 'routes/:id', element: <RouteFormPage /> },
              { path: 'trips', element: <RouteTripsPage /> },
              { path: 'trips/:id', element: <TripDetailPage /> },
              { path: 'settlements', element: <SettlementsPage /> },
            ]
          },
          {
            path: 'my-route',
            element: <MyRoutePage />
          },
          {
            path: 'config',
            children: [
              { index: true, element: <ConfigurationPage /> },
              { path: 'units', element: <UnitsPage /> },
              { path: 'price-lists', element: <PriceListsPage /> },
              { path: 'attributes', element: <AttributesPage /> },
            ]
          },
          {
            path: 'admin',
            element: <AdminRoute />,
            children: [
              { path: 'users', element: <UsersPage /> },
            ]
          },
          {
            path: '*',
            element: <Navigate to="/" replace />
          }
        ]
      }
    ]
  }
]);
