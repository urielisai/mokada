import { useState, useEffect } from 'react';
import { ordersService } from '../services/orders.service';
import { supabase } from '../../../lib/supabase/client';
import { OrdersDashboard } from '../components/OrdersDashboard';
import { Loader2 } from 'lucide-react';

export const OrdersDashboardPage = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();

    // Setup realtime subscription for orders to keep dashboard updated
    const channel = supabase.channel('dashboard_orders_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_orders' },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Fetch orders and agents in parallel
      const [ordersData, agentsResponse] = await Promise.all([
        ordersService.getAllOrders(),
        supabase
          .from('user_profiles')
          .select('auth_user_id, name')
          .eq('user_type', 'AGENT')
      ]);

      setOrders(ordersData);
        
      if (!agentsResponse.error && agentsResponse.data) {
        setAgents(agentsResponse.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#0066CC]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <OrdersDashboard orders={orders} agents={agents} />
    </div>
  );
};
