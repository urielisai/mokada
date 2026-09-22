import { supabase } from '../../../lib/supabase/client';
import type { Database } from '../../../types/database.types';

type RouteTripStatus = Database['public']['Enums']['route_trip_status_type'];

const getCustomerBranchStops = async (routeId: string) => {
  const { data, error } = await (supabase as any)
    .from('customer_branches')
    .select('id, name, municipality, state, phone_primary, latitude, longitude, image_path, route_id, customers(name)')
    .eq('route_id', routeId)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;

  return (data || []).map((branch: any, index: number) => ({
    id: `customer-branch-${branch.id}`,
    route_id: routeId,
    branch_id: branch.id,
    sequence: index + 1,
    estimated_arrival_time: null,
    estimated_duration_minutes: null,
    notes: null,
    customer_branches: branch,
    client_branches: {
      name: branch.name,
      city: branch.municipality,
      state: branch.state,
    },
  }));
};

export const routeService = {
  async getRoutes() {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .order('code');
    if (error) throw error;
    return data;
  },

  async getRoute(id: string) {
    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select('*')
      .eq('id', id)
      .single();
    if (routeError) throw routeError;

    const { data: states, error: statesError } = await supabase
      .from('route_states')
      .select('*')
      .eq('route_id', id)
      .order('sequence');
    if (statesError) throw statesError;

    const { data: stops, error: stopsError } = await supabase
      .from('route_stops')
      .select('*, client_branches(name, city, state)')
      .eq('route_id', id)
      .order('sequence');
    if (stopsError) throw stopsError;

    const customerBranchStops = await getCustomerBranchStops(id);

    return { ...route, states, stops: [...(stops || []), ...customerBranchStops] };
  },

  async saveRoute(payload: any) {
    const { id, states: _states, stops: _stops, ...dataToSave } = payload;
    let request;
    if (id) {
      request = supabase.from('routes').update({ ...dataToSave, updated_at: new Date().toISOString() }).eq('id', id);
    } else {
      request = supabase.from('routes').insert([dataToSave]);
    }
    const { data, error } = await request.select().single();
    if (error) throw error;
    return data;
  },

  async deleteRoute(id: string) {
    const { error } = await supabase.from('routes').delete().eq('id', id);
    if (error) throw error;
  },

  // Route Trips
  async getTrips(filters?: { status?: string; week?: string }) {
    let query = supabase
      .from('route_trips')
      .select('*, routes(code, name), agent:user_profiles!route_trips_agent_id_fkey(first_name, last_name), vehicle:fleet_vehicles!route_trips_vehicle_id_fkey(internal_code, plate_number)')
      .order('week_start_date', { ascending: false });
    
    if (filters?.status) {
      query = query.eq('status', filters.status as RouteTripStatus);
    }
    if (filters?.week) {
      query = query.lte('week_start_date', filters.week).gte('week_end_date', filters.week);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getTrip(id: string) {
    const { data: trip, error: tripError } = await supabase
      .from('route_trips')
      .select('*, routes(code, name, description), agent:user_profiles!route_trips_agent_id_fkey(id, auth_user_id, first_name, last_name, email), vehicle:fleet_vehicles!route_trips_vehicle_id_fkey(internal_code, plate_number, brand, model)')
      .eq('id', id)
      .single();
    if (tripError) throw tripError;

    // Get route stops for itinerary
    const { data: stops, error: stopsError } = await supabase
      .from('route_stops')
      .select('*, client_branches(name, city, state)')
      .eq('route_id', trip.route_id)
      .order('sequence');
    if (stopsError) throw stopsError;

    const customerBranchStops = await getCustomerBranchStops(trip.route_id);

    return { ...trip, stops: [...(stops || []), ...customerBranchStops] };
  },

  async saveTrip(payload: any) {
    const { id, ...dataToSave } = payload;
    let request;
    if (id) {
      request = supabase.from('route_trips').update({ ...dataToSave, updated_at: new Date().toISOString() }).eq('id', id);
    } else {
      request = supabase.from('route_trips').insert([dataToSave]);
    }
    const { data, error } = await request.select().single();
    if (error) throw error;
    return data;
  },

  async updateTripStatus(id: string, status: string) {
    const updates: any = { status: status as RouteTripStatus, updated_at: new Date().toISOString() };
    if (status === 'IN_PROGRESS') updates.started_at = new Date().toISOString();
    if (status === 'COMPLETED') updates.completed_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('route_trips')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getMyCurrentTrip(agentProfileId: string) {
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const { data: active, error: activeErr } = await supabase
      .from('route_trips')
      .select('*, routes(code, name, description), vehicle:fleet_vehicles!route_trips_vehicle_id_fkey(internal_code, plate_number, brand, model)')
      .eq('agent_id', agentProfileId)
      .lte('week_start_date', localDate)
      .gte('week_end_date', localDate)
      .in('status', ['PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'UNDER_REVIEW', 'SETTLED'])
      .order('week_start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (activeErr) throw activeErr;
    return active;
  },

  // Agents for assignment
  async getAgents() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, agent_functions')
      .eq('user_type', 'AGENT')
      .eq('is_active', true)
      .order('first_name');
    if (error) throw error;
    return data;
  },

  // Available vehicles
  async getAvailableVehicles() {
    const { data, error } = await supabase
      .from('fleet_vehicles')
      .select('id, internal_code, plate_number, brand, model')
      .eq('status', 'AVAILABLE')
      .order('internal_code');
    if (error) throw error;
    return data;
  },
};
