import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCandidate } from '../middlewares/candidateAuth.middleware';
import { requireEmployer } from '../middlewares/employerAuth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { uploadChatAttachment } from '../middlewares/upload.middleware';
import { validateObjectIdParam } from '../middlewares/objectIdParam.middleware';
import {
  validateChatBlockBody,
  validateChatContactQuery,
  validateChatConversationId,
  validateChatListQuery,
  validateChatMessagesQuery,
  validateChatOpenBody,
  validateChatSendBody,
  validateChatUnblockParam,
} from '../middlewares/chatValidate.middleware';

function mountChatRoutes(router: Router): void {
  router.get('/', validateChatListQuery, (req, res, next) => {
    void chatController.list(req, res, next);
  });
  router.get('/unread-count', (req, res, next) => {
    void chatController.unreadCount(req, res, next);
  });
  router.post('/open', validateChatOpenBody, (req, res, next) => {
    void chatController.open(req, res, next);
  });
  router.get('/blocked', (req, res, next) => {
    void chatController.listBlocked(req, res, next);
  });
  router.post('/block', validateChatBlockBody, (req, res, next) => {
    void chatController.block(req, res, next);
  });
  router.delete('/block/:userId', validateChatUnblockParam, (req, res, next) => {
    void chatController.unblock(req, res, next);
  });
  router.get('/contact', validateChatContactQuery, (req, res, next) => {
    void chatController.contact(req, res, next);
  });
  router.get('/:id', validateChatConversationId, (req, res, next) => {
    void chatController.getOne(req, res, next);
  });
  router.get(
    '/:id/messages',
    validateChatConversationId,
    validateChatMessagesQuery,
    (req, res, next) => {
      void chatController.listMessages(req, res, next);
    },
  );
  router.post('/:id/messages', validateChatConversationId, validateChatSendBody, (req, res, next) => {
    void chatController.send(req, res, next);
  });
  router.post(
    '/:id/attachments',
    validateChatConversationId,
    uploadChatAttachment('file'),
    (req, res, next) => {
      void chatController.uploadAttachment(req, res, next);
    },
  );
  router.get(
    '/:id/attachments/:mediaId',
    validateChatConversationId,
    validateObjectIdParam('mediaId'),
    (req, res, next) => {
      void chatController.downloadAttachment(req, res, next);
    },
  );
  router.post('/:id/read', validateChatConversationId, (req, res, next) => {
    void chatController.markRead(req, res, next);
  });
}

const candidateChatRouter = Router();
candidateChatRouter.use(authenticate, requireRole('candidate'), requireCandidate);
mountChatRoutes(candidateChatRouter);

const employerChatRouter = Router();
employerChatRouter.use(authenticate, requireRole('employer'), requireEmployer);
mountChatRoutes(employerChatRouter);

export { candidateChatRouter, employerChatRouter };
