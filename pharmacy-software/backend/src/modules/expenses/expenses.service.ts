import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { NotFoundError, ConflictError } from '@/shared/errors/AppError';
import type { CreateExpenseBody, ListExpensesQuery } from './expenses.schemas';

export const expensesService = {
  /** pharmacy.md §12 — entered by the actual logged-in user; a cash expense affects their expected physical cash. */
  async create(body: CreateExpenseBody, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({ data: { ...body, enteredById: actorId } });
      if (body.paymentMethod === 'CASH') {
        await tx.cashLedgerEntry.create({
          data: { portalUserId: actorId, direction: 'OUT', amount: new Decimal(body.amount), category: 'EXPENSE_PAYMENT', isPhysicalCash: true, referenceTable: 'expenses', referenceId: expense.id },
        });
      }
      return expense;
    });
  },

  async list(query: ListExpensesQuery) {
    return prisma.expense.findMany({
      where: { category: query.category, date: { gte: query.from, lte: query.to } },
      include: { enteredByUser: { select: { id: true, fullName: true, username: true } }, approvedByUser: { select: { id: true, fullName: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    });
  },

  async approve(id: string, approverId: string) {
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundError('Expense not found');
    if (expense.approvedById) throw new ConflictError('Expense is already approved');
    return prisma.expense.update({ where: { id }, data: { approvedById: approverId, approvedAt: new Date() } });
  },
};
