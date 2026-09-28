import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';

/**
 * Public Razorpay checkout page, browser callback, and webhook (sheet 358).
 * Checkout links are HMAC-signed and short-lived. Simulated payments never hit these routes.
 */
const paymentGatewayRouter = Router();

paymentGatewayRouter.get('/gateway/:id', (req, res, next) => {
  void paymentController.gatewayCheckout(req, res, next);
});

paymentGatewayRouter.post('/gateway/callback', (req, res, next) => {
  void paymentController.gatewayCallback(req, res, next);
});

paymentGatewayRouter.post('/webhook/razorpay', (req, res, next) => {
  void paymentController.razorpayWebhook(req, res, next);
});

export default paymentGatewayRouter;
