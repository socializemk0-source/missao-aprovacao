import { relations } from 'drizzle-orm';
import { integer, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Tabela de Estudantes / Usuários
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // UID do estudante
  email: text('email').notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  targetExam: text('target_exam').default('Polícia Federal'),
  preferredBanca: text('preferred_banca').default('Cebraspe'),
  city: text('city').default('Brasil'),
  whatsapp: text('whatsapp').default(''),
  plan: text('plan').default('free'),
  planPrice: text('plan_price').default('R$ 29,90'),
  // Fim do passe PRO (pagamento avulso). NULL = PRO sem validade (assinatura).
  proUntil: timestamp('pro_until', { withTimezone: true }),
  xp: integer('xp').default(0),
  streak: integer('streak').default(1),
  hearts: integer('hearts').default(5),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabela do Quadro de Honra / Ranking Público
export const leaderboard = pgTable('leaderboard', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  name: text('name').notNull(),
  targetExam: text('target_exam').default('Polícia Federal'),
  city: text('city').default('Brasil'),
  questionsAnswered: integer('questions_answered').default(0),
  streak: integer('streak').default(1),
  xp: integer('xp').default(0),
  plan: text('plan').default('free'),
  photoUrl: text('photo_url').default(''),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabela de Progresso Detalhado
export const userProgress = pgTable('user_progress', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  completedPhases: text('completed_phases').default('[]'),
  totalQuestionsAnswered: integer('total_questions_answered').default(0),
  correctAnswers: integer('correct_answers').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Snapshot completo do estado do jogo (trilha) por usuário — ver
// supabase/migrations/20260924000000_create_game_snapshots.sql.
export const gameSnapshots = pgTable('game_snapshots', {
  userId: text('user_id').primaryKey(),
  state: text('state').notNull(),
  xp: integer('xp').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabela de Redações Enviadas e Avaliadas
export const essays = pgTable('essays', {
  id: serial('id').primaryKey(),
  essayId: text('essay_id').notNull().unique(),
  userId: text('user_id').notNull(),
  topic: text('topic').notNull(),
  banca: text('banca').default('Cebraspe'),
  content: text('content').notNull(),
  score: integer('score').default(0),
  feedback: text('feedback').default(''),
  criterios: text('criterios').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabela de Missões Diárias
export const dailyMissions = pgTable('daily_missions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  dateStr: text('date_str').notNull(),
  missionId: text('mission_id').notNull(),
  progress: integer('progress').default(0),
  target: integer('target').default(1),
  completed: integer('completed').default(0),
  claimed: integer('claimed').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabela de Perfis do Estudante vinculada a auth.users (Supabase profiles)
export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(), // ID vinculado a auth.users(id)
  fullName: text('full_name').notNull(),
  bio: text('bio').default(''),
  avatarUrl: text('avatar_url').default(''),
  targetExam: text('target_exam').default('Polícia Federal'),
  preferredBanca: text('preferred_banca').default('Cebraspe'),
  city: text('city').default('Brasil'),
  phone: text('phone').default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tabela de Dicas e Macetes Visualizados / Dominados por Concurseiros
export const viewedTips = pgTable('viewed_tips', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  tipId: text('tip_id').notNull(),
  title: text('title').notNull(),
  banca: text('banca').default('Geral'),
  viewCount: integer('view_count').default(1),
  mastered: integer('mastered').default(0), // 0 ou 1
  favorited: integer('favorited').default(0), // 0 ou 1
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Assinatura recorrente do Plano PRO (AbacatePay Subscriptions). Uma
// linha por usuário com o estado atual — atualizada a cada webhook
// subscription.* da AbacatePay (completed/renewed/payment_failed/cancelled).
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(), // uid do Supabase Auth — nunca vindo do cliente
  providerCustomerId: text('provider_customer_id'), // customer da AbacatePay — criado uma vez, reaproveitado
  providerSubscriptionId: text('provider_subscription_id').unique(),
  status: text('status').notNull().default('none'), // none | pending | active | payment_failed | cancelled
  plan: text('plan').default('pro'),
  amount: numeric('amount', { precision: 10, scale: 2 }).default('29.90'),
  currency: text('currency').default('BRL'),
  nextPaymentDate: timestamp('next_payment_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Histórico de cobranças recorrentes já processadas — registro de
// auditoria e chave de idempotência (providerPaymentId é único: o webhook
// da AbacatePay pode reenviar a mesma notificação várias vezes, e nunca
// deve aplicar a mesma cobrança duas vezes).
export const subscriptionPayments = pgTable('subscription_payments', {
  id: serial('id').primaryKey(),
  providerPaymentId: text('provider_payment_id').notNull().unique(), // ID do pagamento na AbacatePay
  providerSubscriptionId: text('provider_subscription_id').notNull(),
  userId: text('user_id').notNull(),
  status: text('status').notNull(), // paid | pending | failed | ...
  amount: numeric('amount', { precision: 10, scale: 2 }),
  currency: text('currency').default('BRL'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relações entre tabelas
export const usersRelations = relations(users, ({ many, one }) => ({
  essays: many(essays),
  progress: many(userProgress),
  profile: one(profiles, {
    fields: [users.uid],
    references: [profiles.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.id],
    references: [users.uid],
  }),
}));

export const essaysRelations = relations(essays, ({ one }) => ({
  author: one(users, {
    fields: [essays.userId],
    references: [users.uid],
  }),
}));
