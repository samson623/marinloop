-- AI chat history for GPT-5 nano and similar models
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  model text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_ai_conversations_user_created on public.ai_conversations(user_id, created_at desc);

alter table public.ai_conversations enable row level security;

drop policy if exists ai_conversations_select_own on public.ai_conversations;
create policy ai_conversations_select_own on public.ai_conversations
for select using (auth.uid() = user_id);

drop policy if exists ai_conversations_insert_own on public.ai_conversations;
create policy ai_conversations_insert_own on public.ai_conversations
for insert with check (auth.uid() = user_id);

drop policy if exists ai_conversations_delete_own on public.ai_conversations;
create policy ai_conversations_delete_own on public.ai_conversations
for delete using (auth.uid() = user_id);
