begin;

create table if not exists public.agendamentos (
  id bigint generated always as identity primary key,
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  telefone text not null check (telefone ~ '^[0-9]{10,15}$'),
  servico text not null,
  preco integer not null check (preco >= 0),
  data date not null,
  horario text not null,
  barbeiro text not null,
  turno text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_agendamentos_vagas
  on public.agendamentos (data, barbeiro, turno);

alter table public.agendamentos enable row level security;
revoke all on table public.agendamentos from public, anon, authenticated;
revoke all on sequence public.agendamentos_id_seq from public, anon, authenticated;

create or replace function public.config_agendamentos()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select '{
    "barbeiros": ["Alexandre", "Luiz", "Matheus"],
    "turnos": [
      {"id": "manha", "nome": "Manhã", "inicio": "08:30", "fim": "12:00"},
      {"id": "tarde", "nome": "Tarde", "inicio": "13:00", "fim": "18:00"},
      {"id": "noite", "nome": "Noite", "inicio": "18:00", "fim": "20:00"}
    ],
    "servicos": [
      {"nome": "Corte", "preco": 50},
      {"nome": "Barba", "preco": 40},
      {"nome": "Corte + barba", "preco": 80},
      {"nome": "Acabamento", "preco": 20}
    ],
    "limite": 10
  }'::jsonb;
$$;

create or replace function public.vagas_agendamentos(p_data date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  config jsonb := public.config_agendamentos();
  vagas jsonb := '{}'::jsonb;
  por_turno jsonb;
  nome_barbeiro text;
  config_turno jsonb;
  usados integer;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_data is null or p_data < hoje or p_data > hoje + 60 then
    raise exception using errcode = '22023', message = 'Escolha uma data entre hoje e os próximos 60 dias.';
  end if;

  for nome_barbeiro in select jsonb_array_elements_text(config->'barbeiros') loop
    por_turno := '{}'::jsonb;
    for config_turno in select jsonb_array_elements(config->'turnos') loop
      select count(*) into usados from public.agendamentos a
        where a.data = p_data and a.barbeiro = nome_barbeiro and a.turno = config_turno->>'id';
      por_turno := por_turno || jsonb_build_object(
        config_turno->>'id', jsonb_build_object(
          'usados', usados, 'restantes', greatest(0, (config->>'limite')::integer - usados)
        )
      );
    end loop;
    vagas := vagas || jsonb_build_object(nome_barbeiro, por_turno);
  end loop;
  return jsonb_build_object('data', p_data, 'limite', config->'limite', 'vagas', vagas);
end;
$$;

create or replace function public.criar_agendamento(
  p_nome text,
  p_telefone text,
  p_servico text,
  p_data date,
  p_barbeiro text,
  p_turno text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  config jsonb := public.config_agendamentos();
  turno jsonb;
  preco integer;
  usados integer;
  novo_id bigint;
  telefone text := regexp_replace(p_telefone, '[^0-9]', '', 'g');
  agora timestamp := clock_timestamp() at time zone 'America/Sao_Paulo';
begin
  if p_nome is null or char_length(btrim(p_nome)) not between 2 and 120
      or telefone is null or telefone !~ '^[0-9]{10,15}$' then
    raise exception using errcode = '22023', message = 'Informe um nome e telefone com DDD válidos.';
  end if;
  if p_data is null or p_data < agora::date or p_data > agora::date + 60 then
    raise exception using errcode = '22023', message = 'Escolha uma data entre hoje e os próximos 60 dias.';
  end if;
  if p_barbeiro is null or not (config->'barbeiros' ? p_barbeiro) then
    raise exception using errcode = '22023', message = 'Barbeiro inválido.';
  end if;
  select item into turno from jsonb_array_elements(config->'turnos') item
    where item->>'id' = p_turno;
  if turno is null then
    raise exception using errcode = '22023', message = 'Turno inválido.';
  end if;
  select (item->>'preco')::integer into preco
    from jsonb_array_elements(config->'servicos') item where item->>'nome' = p_servico;
  if preco is null then
    raise exception using errcode = '22023', message = 'Serviço inválido.';
  end if;
  if extract(dow from p_data) in (0, 1)
      or (extract(dow from p_data) = 6 and p_turno = 'noite') then
    raise exception using errcode = '22023', message = 'A barbearia está fechada neste dia ou turno.';
  end if;

  -- Serializa a contagem e a insercao na mesma data/barbeiro/turno.
  perform pg_advisory_xact_lock(hashtextextended(
    p_data::text || '|' || p_barbeiro || '|' || p_turno, 0
  ));
  agora := clock_timestamp() at time zone 'America/Sao_Paulo';
  if p_data < agora::date
      or (p_data = agora::date and (turno->>'fim')::time <= agora::time) then
    raise exception using errcode = '22023', message = 'Este turno já terminou. Escolha outro turno ou dia.';
  end if;
  select count(*) into usados from public.agendamentos a
    where a.data = p_data and a.barbeiro = p_barbeiro and a.turno = p_turno;
  if usados >= (config->>'limite')::integer then
    return jsonb_build_object(
      'success', false, 'error', 'Este turno está lotado. Escolha outro turno ou barbeiro.'
    );
  end if;

  insert into public.agendamentos (nome, telefone, servico, preco, data, horario, barbeiro, turno)
    values (btrim(p_nome), telefone, p_servico, preco, p_data,
      (turno->>'inicio') || '-' || (turno->>'fim'), p_barbeiro, p_turno)
    returning id into novo_id;
  return jsonb_build_object('success', true, 'id', novo_id, 'posicao', usados + 1, 'preco', preco);
end;
$$;

revoke all on function public.config_agendamentos() from public, anon, authenticated;
revoke all on function public.vagas_agendamentos(date) from public, anon, authenticated;
revoke all on function public.criar_agendamento(text, text, text, date, text, text) from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant execute on function public.config_agendamentos() to anon, authenticated;
grant execute on function public.vagas_agendamentos(date) to anon, authenticated;
grant execute on function public.criar_agendamento(text, text, text, date, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
