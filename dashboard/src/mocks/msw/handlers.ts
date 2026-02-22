import { getAllMocks as shoppingCart_notification_listener_handlers } from '@/tmf/shoppingCart/notification-listener/notification-listener.msw';
import { getAllMocks as shoppingCart_shopping_cart_handlers } from '@/tmf/shoppingCart/shopping-cart/shopping-cart.msw';
import { getAllMocks as shoppingCart_events_subscription_handlers } from '@/tmf/shoppingCart/events-subscription/events-subscription.msw';


export const handlers = [
  ...shoppingCart_notification_listener_handlers(),
  ...shoppingCart_shopping_cart_handlers(),
  ...shoppingCart_events_subscription_handlers(),

];
