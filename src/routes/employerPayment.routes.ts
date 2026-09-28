import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { EMPLOYER_PERMISSIONS } from '../constants/employerPermissions';
import { authenticate } from '../middlewares/auth.middleware';
import {
  requireEmployer,
  requireEmployerPermission,
} from '../middlewares/employerAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import {
  validateInvoiceIdParam,
  validateInvoiceQuery,
  validatePaymentCheckout,
  validatePaymentConfirm,
  validatePaymentFail,
  validatePaymentIdParam,
  validatePaymentQuery,
  validateWalletTxnQuery,
} from '../middlewares/paymentValidate.middleware';

/**
 * Employer payments, wallet, and GST invoices (sheet 351–365).
 * Razorpay when RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set (358).
 * Otherwise confirm/fail stay simulated.
 */
const employerPaymentRouter = Router();

employerPaymentRouter.use(authenticate, requireRole('employer'), requireEmployer);

employerPaymentRouter.get('/credit-packs', (req, res, next) => {
  void paymentController.listCreditPacks(req, res, next);
});

employerPaymentRouter.get('/wallet', (req, res, next) => {
  void paymentController.getWallet(req, res, next);
});

employerPaymentRouter.get(
  '/wallet/transactions',
  validateWalletTxnQuery,
  (req, res, next) => {
    void paymentController.listWalletTransactions(req, res, next);
  },
);

employerPaymentRouter.get('/invoices', validateInvoiceQuery, (req, res, next) => {
  void paymentController.listInvoices(req, res, next);
});

employerPaymentRouter.get(
  '/invoices/:id',
  validateInvoiceIdParam,
  (req, res, next) => {
    void paymentController.getInvoice(req, res, next);
  },
);

employerPaymentRouter.get('/payments', validatePaymentQuery, (req, res, next) => {
  void paymentController.list(req, res, next);
});

employerPaymentRouter.post(
  '/payments/checkout',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.BILLING_MANAGE),
  validatePaymentCheckout,
  (req, res, next) => {
    void paymentController.checkout(req, res, next);
  },
);

employerPaymentRouter.get(
  '/payments/:id',
  validatePaymentIdParam,
  (req, res, next) => {
    void paymentController.getById(req, res, next);
  },
);

employerPaymentRouter.post(
  '/payments/:id/confirm',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.BILLING_MANAGE),
  validatePaymentIdParam,
  validatePaymentConfirm,
  (req, res, next) => {
    void paymentController.confirm(req, res, next);
  },
);

employerPaymentRouter.post(
  '/payments/:id/fail',
  requireEmployerPermission(EMPLOYER_PERMISSIONS.BILLING_MANAGE),
  validatePaymentIdParam,
  validatePaymentFail,
  (req, res, next) => {
    void paymentController.fail(req, res, next);
  },
);

export default employerPaymentRouter;
