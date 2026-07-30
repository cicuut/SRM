
CREATE TABLE public.clinic (
  clinic_id uuid NOT NULL,
  clinic_name character varying NOT NULL,
  clinic_address text NOT NULL,
  license_number text NOT NULL,
  clinic_email character varying NOT NULL,
  clinic_phone text NOT NULL,
  CONSTRAINT clinic_pkey PRIMARY KEY (clinic_id)
);
CREATE TABLE public.users (
  user_id uuid NOT NULL,
  clinic_id uuid,
  fullname character varying NOT NULL,
  password_hash character varying NOT NULL,
  user_role character varying NOT NULL,
  strnumber text,
  email character varying NOT NULL,
  is_active boolean,
  profile_photo text,
  last_login timestamp without time zone NOT NULL DEFAULT timezone('Asia/Jakarta'::text, now()),
  created_at timestamp without time zone NOT NULL DEFAULT timezone('Asia/Jakarta'::text, now()),
  failed_login_attempts smallint DEFAULT '0'::smallint,
  locked_until timestamp without time zone,
  CONSTRAINT users_pkey PRIMARY KEY (user_id),
  CONSTRAINT users_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinic(clinic_id)
);
CREATE TABLE public.patient (
  patient_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  family_link_id uuid,
  patient_name text NOT NULL,
  birth_date date NOT NULL,
  role character varying,
  national_id text,
  address text NOT NULL,
  patient_number text,
  gender character varying NOT NULL,
  education_level character varying,
  occupation character varying,
  insurance_number text,
  primary_health_facility character varying,
  relation character varying,
  CONSTRAINT patient_pkey PRIMARY KEY (patient_id),
  CONSTRAINT patient_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinic(clinic_id),
  CONSTRAINT patient_family_link_id_fkey FOREIGN KEY (family_link_id) REFERENCES public.patient(patient_id)
);

CREATE TABLE public.medical_record (
  record_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  patient_id uuid,
  record_number character varying NOT NULL,
  record_type character varying NOT NULL,
  status character varying NOT NULL,
  created_at timestamp without time zone,
  last_update timestamp without time zone,
  CONSTRAINT medical_record_pkey PRIMARY KEY (record_id),
  CONSTRAINT medical_record_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinic(clinic_id),
  CONSTRAINT medical_record_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient(patient_id)
);

CREATE TABLE public.medical_record_sequence (
  year integer NOT NULL,
  record_type character varying NOT NULL,
  clinic_id uuid NOT NULL,
  last_number integer NOT NULL,
  CONSTRAINT medical_record_sequence_pkey PRIMARY KEY (year, record_type, clinic_id),
  CONSTRAINT medical_record_sequence_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinic(clinic_id)
);

CREATE TABLE public.pregnancy_record (
  pr_id uuid NOT NULL,
  record_id uuid,
  contraceptive_history text,
  family_med_history text,
  last_menstrual_period date,
  expected_due_date date,
  diagnosis text,
  height_cm double precision,
  weight_kg double precision,
  muac_cm double precision,
  tt_screening character varying,
  registration_date timestamp without time zone,
  lab_results text,
  pre_preg_muac_cm double precision,
  pre_preg_weight_kg double precision,
  CONSTRAINT pregnancy_record_pkey PRIMARY KEY (pr_id),
  CONSTRAINT pregnancy_record_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.medical_record(record_id)
);

CREATE TABLE public.obstetric_history (
  history_id uuid NOT NULL,
  pr_id uuid,
  pregnancy_no integer,
  gestational_age character varying,
  pregnancy_complications text,
  delivery_mode character varying,
  delivery_complications text,
  baby_weight double precision,
  baby_height double precision,
  baby_complications text,
  postpartum_status text,
  postpartum_complications text,
  CONSTRAINT obstetric_history_pkey PRIMARY KEY (history_id),
  CONSTRAINT obstetric_history_pr_id_fkey FOREIGN KEY (pr_id) REFERENCES public.pregnancy_record(pr_id)
);

CREATE TABLE public.kb_record (
  kb_id uuid NOT NULL,
  record_id uuid,
  number_of_children integer,
  youngest_child_age text,
  family_med_history text,
  CONSTRAINT kb_record_pkey PRIMARY KEY (kb_id),
  CONSTRAINT kb_record_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.medical_record(record_id)
);
CREATE TABLE public.general_record (
  gr_id uuid NOT NULL,
  record_id uuid,
  CONSTRAINT general_record_pkey PRIMARY KEY (gr_id),
  CONSTRAINT general_record_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.medical_record(record_id)
);
CREATE TABLE public.delivery_record (
  dr_id uuid NOT NULL,
  record_id uuid,
  delivery_date date,
  delivery_type character varying,
  deliver_complications text,
  baby_gender character varying NOT NULL,
  baby_weight double precision,
  baby_length double precision,
  apgar_score character varying,
  baby_complications text,
  vit_k_given boolean NOT NULL,
  hbo_given boolean NOT NULL,
  eye_ointment boolean NOT NULL,
  imd boolean NOT NULL,
  CONSTRAINT delivery_record_pkey PRIMARY KEY (dr_id),
  CONSTRAINT delivery_record_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.medical_record(record_id)
);
CREATE TABLE public.immunization_record (
  ir_id uuid NOT NULL,
  record_id uuid,
  hbo_1 date,
  bcg_1 date,
  polio_1 date,
  polio_2 date,
  polio_3 date,
  polio_4 date,
  dpt_1 date,
  dpt_2 date,
  dpt_3 date,
  dpt_4 date,
  pcv_1 date,
  pcv_2 date,
  pcv_3 date,
  campak_1 date,
  campak_2 date,
  ipv_1 date,
  ipv_2 date,
  rotavirus_1 date,
  rotavirus_2 date,
  rotavirus_3 date,
  CONSTRAINT immunization_record_pkey PRIMARY KEY (ir_id),
  CONSTRAINT immunization_record_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.medical_record(record_id)
);
CREATE TABLE public.visit_master (
  visit_id uuid NOT NULL,
  record_id uuid,
  clinic_id uuid NOT NULL,
  user_id uuid,
  visit_number character varying NOT NULL,
  visit_date date,
  visit_time timestamp with time zone,
  CONSTRAINT visit_master_pkey PRIMARY KEY (visit_id),
  CONSTRAINT visit_master_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.medical_record(record_id),
  CONSTRAINT visit_master_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinic(clinic_id),
  CONSTRAINT visit_master_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);

CREATE TABLE public.visit_sequence (
  year integer NOT NULL,
  clinic_id uuid NOT NULL,
  last_number integer NOT NULL,
  CONSTRAINT visit_sequence_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinic(clinic_id)
);

CREATE TABLE public.pregnancy_visit (
  visit_anc_id uuid NOT NULL,
  visit_id uuid,
  pr_id uuid,
  blood_pressure character varying,
  weight_kg double precision,
  height_cm double precision,
  body_temperature double precision,
  respiratory_rate double precision,
  heart_rate double precision,
  subjective text,
  objective text,
  assessment text,
  plan text,
  CONSTRAINT pregnancy_visit_pkey PRIMARY KEY (visit_anc_id),
  CONSTRAINT pregnancy_visit_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visit_master(visit_id),
  CONSTRAINT pregnancy_visit_pr_id_fkey FOREIGN KEY (pr_id) REFERENCES public.pregnancy_record(pr_id)
);
CREATE TABLE public.kb_visit (
  visit_kb_id uuid NOT NULL,
  visit_id uuid,
  kb_id uuid,
  weight_kg double precision,
  blood_pressure character varying,
  kb_method character varying,
  return_visit_date date,
  complaint text,
  CONSTRAINT kb_visit_pkey PRIMARY KEY (visit_kb_id),
  CONSTRAINT kb_visit_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visit_master(visit_id),
  CONSTRAINT kb_visit_kb_id_fkey FOREIGN KEY (kb_id) REFERENCES public.kb_record(kb_id)
);
CREATE TABLE public.immunization_visit (
  visit_imun_id uuid NOT NULL,
  visit_id uuid,
  ir_id uuid,
  baby_weight character varying,
  baby_height character varying,
  body_temp character varying,
  head_circumference character varying,
  abdominal_circumference character varying,
  dosage_given character varying,
  vaccine_given character varying,
  CONSTRAINT immunization_visit_pkey PRIMARY KEY (visit_imun_id),
  CONSTRAINT immunization_visit_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visit_master(visit_id),
  CONSTRAINT immunization_visit_ir_id_fkey FOREIGN KEY (ir_id) REFERENCES public.immunization_record(ir_id)
);
CREATE TABLE public.general_visit (
  visit_gen_id uuid NOT NULL,
  visit_id uuid,
  gr_id uuid,
  subjective text,
  objective text,
  assessment text,
  plan text,
  CONSTRAINT general_visit_pkey PRIMARY KEY (visit_gen_id),
  CONSTRAINT general_visit_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visit_master(visit_id),
  CONSTRAINT general_visit_gr_id_fkey FOREIGN KEY (gr_id) REFERENCES public.general_record(gr_id)
);


CREATE TABLE public.audit (
  log_id uuid NOT NULL,
  user_id uuid,
  audit_number character varying NOT NULL,
  times timestamp without time zone NOT NULL,
  action character varying NOT NULL,
  old_values jsonb,
  new_values jsonb,
  clinic_id uuid,
  CONSTRAINT audit_pkey PRIMARY KEY (log_id),
  CONSTRAINT audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT audit_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinic(clinic_id)
);

CREATE TABLE public.audit_sequence (
  year integer NOT NULL,
  clinic_id uuid NOT NULL,
  last_number integer NOT NULL,
  CONSTRAINT audit_sequence_pkey PRIMARY KEY (year, clinic_id),
  CONSTRAINT audit_sequence_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinic(clinic_id)
);

CREATE TABLE public.financial (
  transaction_id uuid NOT NULL,
  visit_id uuid,
  clinic_id uuid,
  user_id uuid,
  patient_id uuid,
  transaction_number character varying NOT NULL,
  trans_type character varying NOT NULL,
  amount double precision,
  payment_method character varying,
  status character varying NOT NULL,
  payment_date date NOT NULL,
  description text,
  CONSTRAINT financial_pkey PRIMARY KEY (transaction_id),
  CONSTRAINT financial_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT financial_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visit_master(visit_id),
  CONSTRAINT financial_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinic(clinic_id),
  CONSTRAINT financial_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient(patient_id)
);

CREATE TABLE public.financial_sequence (
  year integer NOT NULL,
  clinic_id uuid NOT NULL,
  last_number integer NOT NULL,
  CONSTRAINT financial_sequence_pkey PRIMARY KEY (year, clinic_id),
  CONSTRAINT financial_sequence_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinic(clinic_id)
);