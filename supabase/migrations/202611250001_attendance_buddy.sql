-- Attendance Buddy: run once in a fresh Supabase project's SQL editor.
begin;
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 100),
 timezone text not null default 'Asia/Kolkata', created_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, org_id uuid references public.organizations(id),
 full_name text not null check(length(full_name) between 2 and 100), email text not null,
 role text not null default 'employee' check(role in ('admin','employee')), department text not null default 'General',
 is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.locations (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 name text not null check(length(name) between 2 and 100), address text not null check(length(address) between 3 and 240),
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 radius integer not null default 100 check(radius between 20 and 2000), token uuid not null unique default gen_random_uuid(),
 is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.shifts (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 location_id uuid not null references public.locations(id), name text not null check(length(name) between 2 and 100),
 start_time time not null, end_time time not null, days integer[] not null default '{1,2,3,4,5}',
 is_active boolean not null default true,
 check(start_time<>end_time),check(cardinality(days) between 1 and 7 and days <@ array[0,1,2,3,4,5,6]), created_at timestamptz not null default now()
);
create table public.shift_members (
 shift_id uuid not null references public.shifts(id) on delete cascade, user_id uuid not null references public.profiles(id), primary key(shift_id,user_id)
);
create table public.attendance (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id), user_id uuid not null references public.profiles(id),
 location_id uuid not null references public.locations(id), shift_id uuid references public.shifts(id), action text not null check(action in ('in','out')),
 status text not null check(status in ('on_time','late','early')), occurred_at timestamptz not null default now(),
 latitude double precision not null, longitude double precision not null, distance double precision not null, accuracy double precision not null,
 photo_path text, original_at timestamptz, corrected boolean not null default false
);
create index attendance_user_time on public.attendance(user_id,occurred_at desc);
create index attendance_org_time on public.attendance(org_id,occurred_at desc);
create table public.corrections (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id), user_id uuid not null references public.profiles(id),
 attendance_id uuid not null references public.attendance(id), requested_time timestamptz not null,
 reason text not null check(length(reason) between 10 and 1000),status text not null default 'pending' check(status in ('pending','approved','rejected')),
 review_note text,reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,created_at timestamptz not null default now()
);
create unique index one_pending_correction on public.corrections(attendance_id) where status='pending';
create table public.invitations (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id), email text not null,
 full_name text not null check(length(full_name) between 2 and 100),department text not null default 'General',token uuid not null unique default gen_random_uuid(),
 accepted boolean not null default false,revoked boolean not null default false,expires_at timestamptz not null default now()+interval '7 days',created_at timestamptz not null default now()
);
create unique index pending_invite_email on public.invitations(org_id,lower(email)) where accepted=false and revoked=false;
create table public.audit_log (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.organizations(id),actor_id uuid references public.profiles(id),
 action text not null,entity text not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);

-- Helpers deliberately use an empty search path and re-read the authenticated profile.
create function private.my_org() returns uuid language sql stable security definer set search_path='' as $$
 select org_id from public.profiles where id=auth.uid() and is_active;
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select role='admin' and is_active from public.profiles where id=auth.uid()),false);
$$;
create function private.new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,email,full_name) values(new.id,new.email,left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1),'Member'),100));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.new_user();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_members enable row level security;
alter table public.attendance enable row level security;
alter table public.corrections enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;
create policy organization_read on public.organizations for select to authenticated using(id=private.my_org());
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or (org_id=private.my_org() and private.is_admin()));
create policy location_read on public.locations for select to authenticated using(org_id=private.my_org());
create policy location_create on public.locations for insert to authenticated with check(org_id=private.my_org() and private.is_admin());
create policy location_update on public.locations for update to authenticated using(org_id=private.my_org() and private.is_admin()) with check(org_id=private.my_org() and private.is_admin());
create policy shift_read on public.shifts for select to authenticated using(org_id=private.my_org());
create policy assignment_read on public.shift_members for select to authenticated using(exists(select 1 from public.shifts s where s.id=shift_id and s.org_id=private.my_org()) and (user_id=auth.uid() or private.is_admin()));
create policy attendance_read on public.attendance for select to authenticated using(org_id=private.my_org() and (user_id=auth.uid() or private.is_admin()));
create policy correction_read on public.corrections for select to authenticated using(org_id=private.my_org() and (user_id=auth.uid() or private.is_admin()));
create policy correction_create on public.corrections for insert to authenticated with check(org_id=private.my_org() and user_id=auth.uid() and status='pending' and review_note is null and reviewed_by is null and reviewed_at is null and exists(select 1 from public.attendance a where a.id=attendance_id and a.user_id=auth.uid() and a.org_id=private.my_org()) and requested_time<=now() and requested_time>=now()-interval '60 days');
create policy invite_read on public.invitations for select to authenticated using(org_id=private.my_org() and private.is_admin());
create policy invite_create on public.invitations for insert to authenticated with check(org_id=private.my_org() and private.is_admin() and not accepted and not revoked and expires_at>now() and expires_at<=now()+interval '7 days');
create policy audit_read on public.audit_log for select to authenticated using(org_id=private.my_org() and private.is_admin());

-- No table writes for protected transactions. They are exposed only through checked RPCs.
revoke all on public.organizations,public.profiles,public.locations,public.shifts,public.shift_members,public.attendance,public.corrections,public.invitations,public.audit_log from anon,authenticated;
grant select on public.organizations,public.profiles,public.locations,public.shifts,public.shift_members,public.attendance,public.corrections,public.invitations,public.audit_log to authenticated;
grant insert on public.locations,public.corrections,public.invitations to authenticated;
grant update(is_active) on public.locations to authenticated;

create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare detail jsonb;
begin
 detail:=jsonb_build_object('id',new.id);
 if tg_table_name='attendance' then
  detail:=detail||jsonb_build_object('user_id',new.user_id,'occurred_at',new.occurred_at,'status',new.status,'previous_time',case when tg_op='UPDATE' then old.occurred_at else null end);
 end if;
 if tg_table_name='corrections' then detail:=detail||jsonb_build_object('status',new.status,'reviewed_by',new.reviewed_by);end if;
 insert into public.audit_log(org_id,actor_id,action,entity,details) values(new.org_id,auth.uid(),lower(tg_op),tg_table_name,detail);return new;
end $$;
create trigger audit_locations after insert or update on public.locations for each row execute function private.audit_change();
create trigger audit_shifts after insert or update on public.shifts for each row execute function private.audit_change();
create trigger audit_attendance after insert or update on public.attendance for each row execute function private.audit_change();
create trigger audit_corrections after insert or update on public.corrections for each row execute function private.audit_change();
create trigger audit_invites after insert or update on public.invitations for each row execute function private.audit_change();

create function public.create_workspace(workspace_name text,workspace_timezone text) returns uuid language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 perform 1 from public.profiles where id=auth.uid() and is_active and org_id is null for update;
 if not found then raise exception 'Account already belongs to a workspace or is inactive';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=workspace_timezone) then raise exception 'Invalid timezone';end if;
 insert into public.organizations(name,timezone) values(trim(workspace_name),workspace_timezone) returning id into org;
 update public.profiles set org_id=org,role='admin' where id=auth.uid();return org;
end $$;
create function public.accept_invitation(invite_token uuid) returns void language plpgsql security definer set search_path='' as $$
declare invitation public.invitations;
begin
 perform 1 from public.profiles where id=auth.uid() and org_id is null and is_active for update;
 if not found then raise exception 'Account already belongs to a workspace or is inactive';end if;
 select * into invitation from public.invitations where token=invite_token and not accepted and not revoked and expires_at>now() and lower(email)=lower(auth.jwt()->>'email') for update;
 if not found then raise exception 'Invitation is expired or belongs to another email';end if;
 update public.profiles set org_id=invitation.org_id,full_name=invitation.full_name,department=invitation.department,role='employee' where id=auth.uid();
 update public.invitations set accepted=true where id=invitation.id;
end $$;
create function public.revoke_invitation(target_invitation uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 update public.invitations set revoked=true where id=target_invitation and org_id=private.my_org() and not accepted;
 if not found then raise exception 'Open invitation not found';end if;
end $$;
create function public.update_profile(profile_name text,profile_department text) returns void language plpgsql security definer set search_path='' as $$
begin
 if length(trim(profile_department))>60 then raise exception 'Department too long';end if;
 update public.profiles set full_name=trim(profile_name),department=trim(profile_department) where id=auth.uid() and is_active;
 if not found then raise exception 'Active profile required';end if;
end $$;
create function public.set_member_active(member_id uuid,active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 update public.profiles set is_active=active where id=member_id and org_id=private.my_org() and role='employee';
 if not found then raise exception 'Employee not found';end if;
 insert into public.audit_log(org_id,actor_id,action,entity,details) values(private.my_org(),auth.uid(),'member_status','profiles',jsonb_build_object('id',member_id,'active',active));
end $$;
create function public.create_shift(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;member uuid;
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 if not exists(select 1 from public.locations where id=(payload->>'location_id')::uuid and org_id=private.my_org() and is_active) then raise exception 'Active workplace required';end if;
 insert into public.shifts(org_id,location_id,name,start_time,end_time,days) values(private.my_org(),(payload->>'location_id')::uuid,payload->>'name',(payload->>'start_time')::time,(payload->>'end_time')::time,array(select jsonb_array_elements_text(payload->'days')::integer)) returning id into new_id;
 for member in select jsonb_array_elements_text(payload->'member_ids')::uuid loop
  if not exists(select 1 from public.profiles where id=member and org_id=private.my_org() and is_active) then raise exception 'Member is outside this workspace or inactive';end if;
  insert into public.shift_members values(new_id,member);
 end loop;return new_id;
end $$;
create function public.set_shift_active(target_shift uuid,active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 update public.shifts set is_active=active where id=target_shift and org_id=private.my_org();
 if not found then raise exception 'Shift not found';end if;
end $$;

create function public.mark_attendance(payload jsonb) returns public.attendance language plpgsql security definer set search_path='' as $$
declare
 p public.profiles;loc public.locations;sh public.shifts;previous public.attendance;record public.attendance;
 tz text;local_now timestamp;shift_start timestamp;shift_end timestamp;day_date date;dist double precision;
 lat double precision:=(payload->>'latitude')::double precision;lon double precision:=(payload->>'longitude')::double precision;
 acc double precision:=(payload->>'accuracy')::double precision;act text:=payload->>'action';stat text:='on_time';photo text:=payload->>'photo_path';
begin
 -- Serializes all attendance/correction writes for this member, including concurrent devices.
 select * into p from public.profiles where id=auth.uid() and is_active for update;
 if not found or p.org_id is null then raise exception 'Active workspace membership required';end if;
 if lat is null or lon is null or acc is null or lat not between -90 and 90 or lon not between -180 and 180 or acc not between 0 and 100 or act is null or act not in ('in','out') then raise exception 'Valid GPS coordinates and accuracy of 100m or better are required';end if;
 select * into loc from public.locations where token=(payload->>'token')::uuid and org_id=p.org_id and is_active;
 if not found then raise exception 'This workplace QR is invalid or inactive';end if;
 dist:=6371000*2*asin(sqrt(least(1,power(sin(radians(lat-loc.latitude)/2),2)+cos(radians(lat))*cos(radians(loc.latitude))*power(sin(radians(lon-loc.longitude)/2),2))));
 if dist>loc.radius then raise exception 'You are %m away. Move within the %m workplace radius.',round(dist),loc.radius;end if;
 if photo is not null and (photo not like auth.uid()::text||'/%' or not exists(select 1 from storage.objects where bucket_id='attendance-photos' and name=photo and owner_id=auth.uid()::text)) then raise exception 'Invalid attendance photo';end if;
 select timezone into tz from public.organizations where id=p.org_id;local_now:=now() at time zone tz;
 select * into previous from public.attendance where user_id=p.id order by occurred_at desc limit 1;
 if previous.id is not null and now()-previous.occurred_at<interval '30 seconds' then raise exception 'Please wait 30 seconds between attendance actions';end if;
 if act='in' and previous.action='in' then raise exception 'You are already checked in. Check out first.';end if;
 if act='out' and (previous.id is null or previous.action<>'in') then raise exception 'Check in before checking out.';end if;
 if act='out' and previous.location_id<>loc.id then raise exception 'Check out at the workplace where you checked in.';end if;
 if act='in' then
  -- Match today or yesterday, so an overnight shift retains its starting weekday.
  select s.*,(d.day::date+s.start_time),(d.day::date+s.end_time+case when s.end_time<s.start_time then interval '1 day' else interval '0' end)
   into sh.id,sh.org_id,sh.location_id,sh.name,sh.start_time,sh.end_time,sh.days,sh.is_active,sh.created_at,shift_start,shift_end
   from public.shifts s join public.shift_members sm on sm.shift_id=s.id
   cross join lateral (values(local_now::date),(local_now::date-1)) d(day)
   where sm.user_id=p.id and s.location_id=loc.id and s.org_id=p.org_id and s.is_active and extract(dow from d.day)::int=any(s.days)
   and local_now between d.day::date+s.start_time-interval '2 hours' and d.day::date+s.end_time+case when s.end_time<s.start_time then interval '1 day' else interval '0' end
   order by abs(extract(epoch from local_now-(d.day::date+s.start_time))) limit 1;
  if sh.id is null then raise exception 'No assigned shift is open here. Check your schedule or contact your admin.';end if;
  if local_now>shift_start+interval '15 minutes' then stat:='late';end if;
 else
  select * into sh from public.shifts where id=previous.shift_id;
  day_date:=(previous.occurred_at at time zone tz)::date;
  if sh.end_time<sh.start_time and (previous.occurred_at at time zone tz)::time<sh.start_time-interval '2 hours' then day_date:=day_date-1;end if;
  shift_end:=day_date+sh.end_time+case when sh.end_time<sh.start_time then interval '1 day' else interval '0' end;
  if local_now<shift_end then stat:='early';end if;
 end if;
 insert into public.attendance(org_id,user_id,location_id,shift_id,action,status,latitude,longitude,distance,accuracy,photo_path)
 values(p.org_id,p.id,loc.id,sh.id,act,stat,lat,lon,dist,acc,photo) returning * into record;return record;
end $$;

create function public.review_correction(request_id uuid,decision text,note text) returns void language plpgsql security definer set search_path='' as $$
declare c public.corrections;a public.attendance;before_time timestamptz;after_time timestamptz;tz text;s public.shifts;start_at timestamp;end_at timestamp;new_status text:='on_time';
begin
 if not private.is_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 if decision is null or decision not in ('approved','rejected') or length(trim(note)) not between 3 and 500 then raise exception 'A valid decision and review note are required';end if;
 select * into c from public.corrections where id=request_id and org_id=private.my_org() and status='pending' for update;
 if not found then raise exception 'Pending request not found';end if;
 if c.user_id=auth.uid() then raise exception 'Another administrator must review your own correction';end if;
 perform 1 from public.profiles where id=c.user_id for update;
 if decision='approved' then
  select * into a from public.attendance where id=c.attendance_id for update;
  select max(occurred_at) into before_time from public.attendance where user_id=c.user_id and occurred_at<a.occurred_at;
  select min(occurred_at) into after_time from public.attendance where user_id=c.user_id and occurred_at>a.occurred_at;
  if c.requested_time>now() or c.requested_time<now()-interval '60 days' or c.requested_time<=before_time or c.requested_time>=after_time then raise exception 'Requested time conflicts with attendance sequence or permitted date range';end if;
  select timezone into tz from public.organizations where id=c.org_id;
  if (c.requested_time at time zone tz)::date<>(a.occurred_at at time zone tz)::date then raise exception 'Corrections must stay on the original local date';end if;
  select * into s from public.shifts where id=a.shift_id;
  start_at:=(a.occurred_at at time zone tz)::date+s.start_time;
  if s.end_time<s.start_time and (a.occurred_at at time zone tz)::time<s.start_time-interval '2 hours' then start_at:=start_at-interval '1 day';end if;
  end_at:=start_at::date+s.end_time+case when s.end_time<s.start_time then interval '1 day' else interval '0' end;
  if a.action='in' and (c.requested_time at time zone tz)>start_at+interval '15 minutes' then new_status:='late';end if;
  if a.action='out' and (c.requested_time at time zone tz)<end_at then new_status:='early';end if;
  update public.attendance set original_at=coalesce(original_at,occurred_at),occurred_at=c.requested_time,corrected=true,status=new_status where id=c.attendance_id;
 end if;
 update public.corrections set status=decision,review_note=trim(note),reviewed_by=auth.uid(),reviewed_at=now() where id=c.id;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('attendance-photos','attendance-photos',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy photo_upload on storage.objects for insert to authenticated with check(bucket_id='attendance-photos' and (storage.foldername(name))[1]=auth.uid()::text and private.my_org() is not null);
create policy photo_read on storage.objects for select to authenticated using(bucket_id='attendance-photos' and ((storage.foldername(name))[1]=auth.uid()::text or (private.is_admin() and exists(select 1 from public.attendance a where a.photo_path=name and a.org_id=private.my_org()))));

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.my_org(),private.is_admin() to authenticated;
revoke all on function public.create_workspace(text,text),public.accept_invitation(uuid),public.update_profile(text,text),public.set_member_active(uuid,boolean),public.create_shift(jsonb),public.set_shift_active(uuid,boolean),public.mark_attendance(jsonb),public.review_correction(uuid,text,text) from public,anon;
grant execute on function public.create_workspace(text,text),public.accept_invitation(uuid),public.update_profile(text,text),public.set_member_active(uuid,boolean),public.create_shift(jsonb),public.set_shift_active(uuid,boolean),public.mark_attendance(jsonb),public.review_correction(uuid,text,text) to authenticated;
revoke all on function public.revoke_invitation(uuid) from public,anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;
commit;
