-- Executar somente em um PostgreSQL local descartavel, depois de schema.sql.
-- Os registros de teste sao revertidos ao final.
begin;
set local role anon;

do $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  dia date := hoje + ((2 - extract(dow from hoje)::integer + 7) % 7) + 7;
  sabado date := hoje + ((6 - extract(dow from hoje)::integer + 7) % 7) + 7;
  resultado jsonb;
  i integer;
begin
  if (public.config_agendamentos()->>'limite')::integer <> 10 then
    raise exception 'Limite de vagas incorreto';
  end if;

  begin
    perform public.criar_agendamento('Cliente teste', '00000000000', 'Corte', hoje - 1, 'Alexandre', 'manha');
    raise exception 'Data passada aceita';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.criar_agendamento('Cliente teste', '00000000000', 'Corte', sabado, 'Alexandre', 'noite');
    raise exception 'Sabado a noite aceito';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.criar_agendamento('Cliente teste', '00000000000', 'Corte', dia, 'Outro', 'manha');
    raise exception 'Barbeiro invalido aceito';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.criar_agendamento('Cliente teste', '00000000000', 'Gratis', dia, 'Alexandre', 'manha');
    raise exception 'Servico invalido aceito';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.criar_agendamento('Cliente teste', '123', 'Corte', dia, 'Alexandre', 'manha');
    raise exception 'Telefone invalido aceito';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.criar_agendamento('Cliente teste', '00000000000', 'Corte', dia - 1, 'Alexandre', 'manha');
    raise exception 'Segunda-feira aceita';
  exception when sqlstate '22023' then null;
  end;

  for i in 1..10 loop
    resultado := public.criar_agendamento('Cliente teste', '(00) 00000-0000', 'Corte', dia, 'Alexandre', 'manha');
    if resultado->>'success' <> 'true' or (resultado->>'posicao')::integer <> i
        or (resultado->>'preco')::integer <> 50 then
      raise exception 'Reserva ou preco incorretos';
    end if;
  end loop;
  resultado := public.criar_agendamento('Cliente teste', '00000000000', 'Corte', dia, 'Alexandre', 'manha');
  if resultado->>'success' <> 'false' then
    raise exception 'Decima primeira reserva aceita';
  end if;
  resultado := public.vagas_agendamentos(dia);
  if resultado #>> '{vagas,Alexandre,manha,restantes}' <> '0'
      or resultado #>> '{vagas,Alexandre,manha,usados}' <> '10'
      or resultado #>> '{vagas,Luiz,manha,restantes}' <> '10'
      or resultado::text like '%Cliente teste%' or resultado::text like '%00000000000%' then
    raise exception 'Disponibilidade incorreta ou dados pessoais expostos';
  end if;

  begin
    perform * from public.agendamentos;
    raise exception 'Consulta direta permitida';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.agendamentos;
    raise exception 'Exclusao direta permitida';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.agendamentos set nome = 'Alterado';
    raise exception 'Alteracao direta permitida';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.agendamentos'::regclass) then
    raise exception 'RLS desabilitado';
  end if;
  if (select count(*) from public.agendamentos) <> 10
      or exists (select 1 from public.agendamentos where preco <> 50 or telefone <> '00000000000') then
    raise exception 'Persistencia ou normalizacao incorreta';
  end if;
  if has_table_privilege('anon', 'public.agendamentos', 'INSERT')
      or has_table_privilege('authenticated', 'public.agendamentos', 'SELECT') then
    raise exception 'Privilegios diretos indevidos';
  end if;
end;
$$;

rollback;
