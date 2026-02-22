CREATE TABLE public.file-share (
  file bigint NOT NULL,
  user bigint NOT NULL,
  shared_at timestamp with time zone NOT NULL DEFAULT now(),
  can_write boolean NOT NULL DEFAULT false,
  CONSTRAINT file-share_pkey PRIMARY KEY (file, user),
  CONSTRAINT file-share_file_fkey FOREIGN KEY (file) REFERENCES public.files(id),
  CONSTRAINT file-share_user_fkey FOREIGN KEY (user) REFERENCES public.users(id)
);
CREATE TABLE public.files (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  name text NOT NULL,
  size bigint NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  folder bigint,
  hash text CHECK (length(hash) = 64),
  type text NOT NULL DEFAULT 'application/octet-stream'::text,
  messages ARRAY NOT NULL DEFAULT '{}'::text[],
  is_encrypted boolean NOT NULL DEFAULT false,
  channel text NOT NULL,
  has_thumbnail boolean NOT NULL DEFAULT false,
  owner bigint,
  is_public boolean NOT NULL DEFAULT false,
  CONSTRAINT files_pkey PRIMARY KEY (id),
  CONSTRAINT files_folder_fkey FOREIGN KEY (folder) REFERENCES public.folders(id),
  CONSTRAINT files_owner_fkey FOREIGN KEY (owner) REFERENCES public.users(id)
);
CREATE TABLE public.folders (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  name text NOT NULL,
  parent_folder bigint,
  CONSTRAINT folders_pkey PRIMARY KEY (id),
  CONSTRAINT folders_parent_folder_fkey FOREIGN KEY (parent_folder) REFERENCES public.folders(id)
);
CREATE TABLE public.users (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  salt text NOT NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE VIEW get_file_type_total_size AS SELECT sum(size), type FROM files GROUP BY type;