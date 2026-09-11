-- Distingue cuentas Connect existentes (Accounts v1) de las cuentas nuevas.
-- Esto permite migrar sin invalidar el onboarding de ninguna vendedora.
alter table public.seller_payment_accounts
  add column if not exists account_api_version text not null default 'v1';

alter table public.seller_payment_accounts
  drop constraint if exists seller_payment_account_api_version_check;

alter table public.seller_payment_accounts
  add constraint seller_payment_account_api_version_check
  check (account_api_version in ('v1', 'v2'));

comment on column public.seller_payment_accounts.account_api_version is
  'Versión de Stripe Accounts usada al crear la cuenta; las cuentas previas permanecen en v1.';
