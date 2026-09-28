import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { invoiceService } from '../services/invoice.service';
import { paymentService } from '../services/payment.service';
import { walletService } from '../services/wallet.service';
import { AppError } from '../utils/AppError';
import { sendSuccess } from '../utils/apiResponse';
import type {
  InvoiceQuery,
  PaymentCheckoutInput,
  PaymentConfirmInput,
  PaymentFailInput,
  PaymentQuery,
  PaymentRefundInput,
  PaymentRevenueQuery,
  WalletTxnQuery,
} from '../validators/payment.validator';

type RequestWithValidatedQuery = Request & {
  validatedQuery?: PaymentQuery | WalletTxnQuery | InvoiceQuery | PaymentRevenueQuery;
};

function requireEmployer(req: Request) {
  if (!req.employer) {
    throw new AppError('Employer access required', HTTP_STATUS.FORBIDDEN);
  }
  return req.employer;
}

export class PaymentController {
  async listCreditPacks(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await paymentService.listCreditPacks();
      sendSuccess(res, data, 'Credit packs fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async checkout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employer = requireEmployer(req);
      const data = await paymentService.checkout(
        employer,
        req.body as PaymentCheckoutInput,
      );
      sendSuccess(res, data, 'Payment checkout created', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employer = requireEmployer(req);
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await paymentService.confirm(
        employer,
        id,
        req.body as PaymentConfirmInput,
      );
      sendSuccess(res, data, 'Payment confirmed successfully');
    } catch (error) {
      next(error);
    }
  }

  async fail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employer = requireEmployer(req);
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await paymentService.fail(employer, id, req.body as PaymentFailInput);
      sendSuccess(res, data, 'Payment marked as failed');
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employer = requireEmployer(req);
      const query = (req as RequestWithValidatedQuery).validatedQuery as PaymentQuery;
      const data = await paymentService.list(employer, query);
      sendSuccess(res, data, 'Payments fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employer = requireEmployer(req);
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await paymentService.getById(employer, id);
      sendSuccess(res, data, 'Payment fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employer = requireEmployer(req);
      const data = await walletService.getWallet(employer.companyId);
      sendSuccess(res, data, 'Wallet fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async listWalletTransactions(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const employer = requireEmployer(req);
      const query = (req as RequestWithValidatedQuery).validatedQuery as WalletTxnQuery;
      const data = await walletService.listTransactions(employer.companyId, query);
      sendSuccess(res, data, 'Wallet transactions fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async listInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employer = requireEmployer(req);
      const query = (req as RequestWithValidatedQuery).validatedQuery as InvoiceQuery;
      const data = await invoiceService.list(employer.companyId, query);
      sendSuccess(res, data, 'Invoices fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async getInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employer = requireEmployer(req);
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await invoiceService.getById(employer.companyId, id);
      if (!data) {
        throw new AppError('Invoice not found', HTTP_STATUS.NOT_FOUND);
      }
      sendSuccess(res, data, 'Invoice fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async adminRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const data = await paymentService.adminRefund(id, req.body as PaymentRefundInput);
      sendSuccess(res, data, 'Payment refunded successfully');
    } catch (error) {
      next(error);
    }
  }

  async adminList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as PaymentQuery;
      const data = await paymentService.adminList(query);
      sendSuccess(res, data, 'Payments fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async gatewayCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      const html = await paymentService.gatewayCheckoutHtml(id, token);
      res.status(HTTP_STATUS.OK).type('html').send(html);
    } catch (error) {
      next(error);
    }
  }

  async gatewayCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as {
        paymentId?: string;
        token?: string;
        razorpayOrderId?: string;
        razorpayPaymentId?: string;
        razorpaySignature?: string;
      };
      const data = await paymentService.completeGatewayCallback({
        paymentId: body.paymentId ?? '',
        token: body.token ?? '',
        razorpayOrderId: body.razorpayOrderId ?? '',
        razorpayPaymentId: body.razorpayPaymentId ?? '',
        razorpaySignature: body.razorpaySignature ?? '',
      });
      sendSuccess(res, data, 'Payment confirmed successfully');
    } catch (error) {
      next(error);
    }
  }

  async razorpayWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.header('x-razorpay-signature') ?? '';
      const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
      const data = await paymentService.handleRazorpayWebhook(raw, signature);
      sendSuccess(res, data, 'Webhook processed');
    } catch (error) {
      next(error);
    }
  }

  async adminRevenue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req as RequestWithValidatedQuery).validatedQuery as PaymentRevenueQuery;
      const data = await paymentService.adminRevenueSummary(query ?? {});
      sendSuccess(res, data, 'Revenue summary fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
