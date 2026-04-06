--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: album_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.album_status AS ENUM (
    'draft',
    'published'
);


--
-- Name: game_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.game_type AS ENUM (
    'memory',
    'logic'
);


--
-- Name: point_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.point_source AS ENUM (
    'game',
    'achievement',
    'purchase',
    'refund',
    'admin'
);


--
-- Name: shop_item_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.shop_item_type AS ENUM (
    'sticker',
    'theme',
    'avatar_frame'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ BEGIN
INSERT INTO public.users (id, email, "displayName", "avatarUrl", elder)
VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'displayName',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      NEW.raw_user_meta_data->>'avatarUrl',
      NEW.raw_user_meta_data->>'avatar'
    ),
    COALESCE(
      (NEW.raw_user_meta_data->>'elder')::boolean,
      false
    )
  ) ON CONFLICT (id) DO NOTHING;
RETURN NEW;
END;
$$;


--
-- Name: is_same_family_group(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_same_family_group(target_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users a
    JOIN public.users b ON a."groupId" = b."groupId"
    WHERE a.id = auth.uid()
      AND b.id = target_user_id
      AND a."groupId" IS NOT NULL
  );
$$;


--
-- Name: update_user_streaks_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_streaks_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "gameType" public.game_type NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    icon text,
    condition jsonb NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "createdBy" uuid NOT NULL,
    title text NOT NULL,
    description text,
    "startsAt" timestamp with time zone NOT NULL,
    "endsAt" timestamp with time zone,
    "frequencyId" uuid,
    completed boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    google_event_id text,
    google_sync_status text DEFAULT 'pending'::text,
    "assignedTo" uuid,
    CONSTRAINT activities_google_sync_status_check CHECK ((google_sync_status = ANY (ARRAY['pending'::text, 'synced'::text, 'error'::text])))
);

ALTER TABLE ONLY public.activities REPLICA IDENTITY FULL;


--
-- Name: activity_completions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_completions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "activityId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "completedDate" date NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.activity_completions REPLICA IDENTITY FULL;


--
-- Name: attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "sudokuPuzzleId" uuid,
    "memoryPuzzleId" uuid,
    "logicPuzzleId" uuid,
    "startedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "finishedAt" timestamp with time zone,
    "durationMs" integer,
    score integer,
    success boolean,
    moves integer,
    meta jsonb,
    "isFocusGame" boolean DEFAULT false
);


--
-- Name: device_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    expo_push_token text NOT NULL,
    platform character varying NOT NULL,
    device_id text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    last_seen_at timestamp without time zone DEFAULT now(),
    CONSTRAINT device_tokens_platform_check CHECK (((platform)::text = ANY ((ARRAY['ios'::character varying, 'android'::character varying])::text[])))
);


--
-- Name: familyGroups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."familyGroups" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    "ownerUserId" uuid NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    code text,
    "expiresAt" timestamp with time zone
);


--
-- Name: frequencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.frequencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    label text NOT NULL,
    rrule text
);


--
-- Name: logicGames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."logicGames" (
    "puzzleId" uuid NOT NULL,
    rows integer NOT NULL,
    cols integer NOT NULL,
    "startState" boolean[] NOT NULL,
    solution boolean[]
);


--
-- Name: memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "bookId" uuid NOT NULL,
    "groupId" uuid NOT NULL,
    "createdBy" uuid NOT NULL,
    title text,
    caption text,
    "mediaUrl" text,
    "mimeType" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "spotifyTrackId" text,
    "spotifyUri" text,
    "spotifyData" jsonb
);


--
-- Name: memoriesAlbumPages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."memoriesAlbumPages" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone,
    "albumId" uuid NOT NULL,
    "memoryId" uuid NOT NULL,
    title text,
    description text,
    "order" smallint NOT NULL,
    "imageUrl" text NOT NULL
);


--
-- Name: memoriesAlbums; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."memoriesAlbums" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "groupId" uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    "createdBy" uuid NOT NULL,
    status public.album_status NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone,
    "coverImageUrl" text,
    "urlPdf" text,
    "iaImage" boolean DEFAULT false
);


--
-- Name: memoriesBooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."memoriesBooks" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "groupId" uuid NOT NULL,
    title text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    color text,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: memoryGames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."memoryGames" (
    "puzzleId" uuid NOT NULL,
    rows integer NOT NULL,
    cols integer NOT NULL,
    symbols text[] NOT NULL,
    layout integer[] NOT NULL
);


--
-- Name: memory_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.memory_reactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    memory_id uuid NOT NULL,
    user_id uuid NOT NULL,
    sticker_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mentions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mentioned_user_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    actor_id uuid,
    event_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    title text,
    body text,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: point_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    source public.point_source NOT NULL,
    reference_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    platform text NOT NULL,
    device_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text])))
);


--
-- Name: puzzles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puzzles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    difficulty integer,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "gameType" public.game_type DEFAULT 'memory'::public.game_type NOT NULL,
    "gameName" text
);


--
-- Name: shop_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shop_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    cost integer NOT NULL,
    type public.shop_item_type NOT NULL,
    asset_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT shop_items_cost_check CHECK ((cost >= 0))
);


--
-- Name: streak_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.streak_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "playedDate" date NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sudokuGames; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."sudokuGames" (
    "puzzleId" uuid NOT NULL,
    rows integer NOT NULL,
    cols integer NOT NULL,
    given jsonb,
    solution jsonb,
    CONSTRAINT "sudokuGames_cols_check" CHECK ((cols = 9)),
    CONSTRAINT "sudokuGames_rows_check" CHECK ((rows = 9))
);


--
-- Name: user_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "achievementId" uuid NOT NULL,
    "unlockedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_calendars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_calendars (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "storagePath" text NOT NULL,
    "startDate" date NOT NULL,
    "endDate" date NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_google_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_google_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    scope text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    item_id uuid NOT NULL,
    equipped boolean DEFAULT false,
    acquired_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: user_streaks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_streaks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "currentStreak" integer DEFAULT 0 NOT NULL,
    "longestStreak" integer DEFAULT 0 NOT NULL,
    "lastPlayedDate" date,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    "displayName" text DEFAULT 'usuario'::text NOT NULL,
    "avatarUrl" text,
    "groupId" uuid,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    google_calendar_enabled boolean DEFAULT false,
    google_calendar_id text,
    elder boolean DEFAULT false NOT NULL,
    points_balance integer DEFAULT 0 NOT NULL,
    timezone text
);


--
-- Name: achievements achievements_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_code_key UNIQUE (code);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: activity_completions activity_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_completions
    ADD CONSTRAINT activity_completions_pkey PRIMARY KEY (id);


--
-- Name: attempts attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT attempts_pkey PRIMARY KEY (id);


--
-- Name: device_tokens device_tokens_expo_push_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_expo_push_token_key UNIQUE (expo_push_token);


--
-- Name: device_tokens device_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);


--
-- Name: familyGroups familyGroups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."familyGroups"
    ADD CONSTRAINT "familyGroups_pkey" PRIMARY KEY (id);


--
-- Name: frequencies frequencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.frequencies
    ADD CONSTRAINT frequencies_pkey PRIMARY KEY (id);


--
-- Name: logicGames logicGames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."logicGames"
    ADD CONSTRAINT "logicGames_pkey" PRIMARY KEY ("puzzleId");


--
-- Name: memoriesAlbumPages memoriesAlbumPages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."memoriesAlbumPages"
    ADD CONSTRAINT "memoriesAlbumPages_pkey" PRIMARY KEY (id);


--
-- Name: memoriesAlbums memoriesAlbums_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."memoriesAlbums"
    ADD CONSTRAINT "memoriesAlbums_pkey" PRIMARY KEY (id);


--
-- Name: memoriesBooks memoriesBooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."memoriesBooks"
    ADD CONSTRAINT "memoriesBooks_pkey" PRIMARY KEY (id);


--
-- Name: memories memories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memories
    ADD CONSTRAINT memories_pkey PRIMARY KEY (id);


--
-- Name: memoryGames memoryGames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."memoryGames"
    ADD CONSTRAINT "memoryGames_pkey" PRIMARY KEY ("puzzleId");


--
-- Name: memory_reactions memory_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_reactions
    ADD CONSTRAINT memory_reactions_pkey PRIMARY KEY (id);


--
-- Name: mentions mentions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentions
    ADD CONSTRAINT mentions_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: point_transactions point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_unique_user_token; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_unique_user_token UNIQUE (user_id, token);


--
-- Name: puzzles puzzles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzles
    ADD CONSTRAINT puzzles_pkey PRIMARY KEY (id);


--
-- Name: shop_items shop_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shop_items
    ADD CONSTRAINT shop_items_pkey PRIMARY KEY (id);


--
-- Name: streak_history streak_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_history
    ADD CONSTRAINT streak_history_pkey PRIMARY KEY (id);


--
-- Name: streak_history streak_history_userid_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_history
    ADD CONSTRAINT streak_history_userid_date_unique UNIQUE ("userId", "playedDate");


--
-- Name: sudokuGames sudokuGames_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."sudokuGames"
    ADD CONSTRAINT "sudokuGames_pkey" PRIMARY KEY ("puzzleId");


--
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);


--
-- Name: user_achievements user_achievements_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_unique UNIQUE ("userId", "achievementId");


--
-- Name: user_calendars user_calendars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_calendars
    ADD CONSTRAINT user_calendars_pkey PRIMARY KEY (id);


--
-- Name: user_google_tokens user_google_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_google_tokens
    ADD CONSTRAINT user_google_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_google_tokens user_google_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_google_tokens
    ADD CONSTRAINT user_google_tokens_user_id_key UNIQUE (user_id);


--
-- Name: user_inventory user_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_pkey PRIMARY KEY (id);


--
-- Name: user_streaks user_streaks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_streaks
    ADD CONSTRAINT user_streaks_pkey PRIMARY KEY (id);


--
-- Name: user_streaks user_streaks_userId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_streaks
    ADD CONSTRAINT "user_streaks_userId_key" UNIQUE ("userId");


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_activities_assignedto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_assignedto ON public.activities USING btree ("assignedTo");


--
-- Name: idx_attempts_logicpuzzleid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_logicpuzzleid ON public.attempts USING btree ("logicPuzzleId");


--
-- Name: idx_attempts_memorypuzzleid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_memorypuzzleid ON public.attempts USING btree ("memoryPuzzleId");


--
-- Name: idx_attempts_startedat; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_startedat ON public.attempts USING btree ("startedAt" DESC);


--
-- Name: idx_attempts_sudokupuzzleid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_sudokupuzzleid ON public.attempts USING btree ("sudokuPuzzleId");


--
-- Name: idx_attempts_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attempts_userid ON public.attempts USING btree ("userId");


--
-- Name: idx_device_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_tokens_user ON public.device_tokens USING btree (user_id);


--
-- Name: idx_push_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_tokens_token ON public.push_tokens USING btree (token);


--
-- Name: idx_push_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_tokens_user_id ON public.push_tokens USING btree (user_id);


--
-- Name: idx_puzzles_gametype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_puzzles_gametype ON public.puzzles USING btree ("gameType");


--
-- Name: idx_streak_history_playeddate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_streak_history_playeddate ON public.streak_history USING btree ("playedDate");


--
-- Name: idx_streak_history_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_streak_history_userid ON public.streak_history USING btree ("userId");


--
-- Name: idx_streak_history_userid_playeddate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_streak_history_userid_playeddate ON public.streak_history USING btree ("userId", "playedDate");


--
-- Name: idx_user_achievements_achievementid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_achievements_achievementid ON public.user_achievements USING btree ("achievementId");


--
-- Name: idx_user_achievements_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_achievements_userid ON public.user_achievements USING btree ("userId");


--
-- Name: idx_user_streaks_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_streaks_userid ON public.user_streaks USING btree ("userId");


--
-- Name: user_streaks user_streaks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_streaks_updated_at BEFORE UPDATE ON public.user_streaks FOR EACH ROW EXECUTE FUNCTION public.update_user_streaks_updated_at();


--
-- Name: activities activities_assignedTo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "activities_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES public.users(id);


--
-- Name: activities activities_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "activities_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id);


--
-- Name: activities activities_frequencyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "activities_frequencyId_fkey" FOREIGN KEY ("frequencyId") REFERENCES public.frequencies(id) ON DELETE SET NULL;


--
-- Name: activity_completions activity_completions_activityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_completions
    ADD CONSTRAINT "activity_completions_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES public.activities(id);


--
-- Name: activity_completions activity_completions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_completions
    ADD CONSTRAINT "activity_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: attempts attempts_logicPuzzleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT "attempts_logicPuzzleId_fkey" FOREIGN KEY ("logicPuzzleId") REFERENCES public."logicGames"("puzzleId");


--
-- Name: attempts attempts_memoryPuzzleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT "attempts_memoryPuzzleId_fkey" FOREIGN KEY ("memoryPuzzleId") REFERENCES public."memoryGames"("puzzleId");


--
-- Name: attempts attempts_sudokuPuzzleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT "attempts_sudokuPuzzleId_fkey" FOREIGN KEY ("sudokuPuzzleId") REFERENCES public."sudokuGames"("puzzleId");


--
-- Name: attempts attempts_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempts
    ADD CONSTRAINT "attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: device_tokens device_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: familyGroups familyGroups_ownerUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."familyGroups"
    ADD CONSTRAINT "familyGroups_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES public.users(id);


--
-- Name: logicGames logicGames_puzzleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."logicGames"
    ADD CONSTRAINT "logicGames_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES public.puzzles(id) ON DELETE CASCADE;


--
-- Name: memoriesAlbumPages memoriesAlbumPages_albumId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."memoriesAlbumPages"
    ADD CONSTRAINT "memoriesAlbumPages_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES public."memoriesAlbums"(id);


--
-- Name: memoriesAlbumPages memoriesAlbumPages_memoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."memoriesAlbumPages"
    ADD CONSTRAINT "memoriesAlbumPages_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES public.memories(id);


--
-- Name: memoriesAlbums memoriesAlbums_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."memoriesAlbums"
    ADD CONSTRAINT "memoriesAlbums_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id);


--
-- Name: memoriesAlbums memoriesAlbums_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."memoriesAlbums"
    ADD CONSTRAINT "memoriesAlbums_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."familyGroups"(id);


--
-- Name: memoriesBooks memoriesBooks_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."memoriesBooks"
    ADD CONSTRAINT "memoriesBooks_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."familyGroups"(id) ON DELETE CASCADE;


--
-- Name: memories memories_bookId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memories
    ADD CONSTRAINT "memories_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES public."memoriesBooks"(id) ON DELETE CASCADE;


--
-- Name: memories memories_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memories
    ADD CONSTRAINT "memories_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id);


--
-- Name: memories memories_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memories
    ADD CONSTRAINT "memories_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."familyGroups"(id) ON DELETE CASCADE;


--
-- Name: memoryGames memoryGames_puzzleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."memoryGames"
    ADD CONSTRAINT "memoryGames_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES public.puzzles(id) ON DELETE CASCADE;


--
-- Name: memory_reactions memory_reactions_memory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_reactions
    ADD CONSTRAINT memory_reactions_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES public.memories(id);


--
-- Name: memory_reactions memory_reactions_sticker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_reactions
    ADD CONSTRAINT memory_reactions_sticker_id_fkey FOREIGN KEY (sticker_id) REFERENCES public.shop_items(id);


--
-- Name: memory_reactions memory_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.memory_reactions
    ADD CONSTRAINT memory_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: mentions mentions_mentioned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mentions
    ADD CONSTRAINT mentions_mentioned_user_id_fkey FOREIGN KEY (mentioned_user_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: point_transactions point_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: push_tokens push_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: streak_history streak_history_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.streak_history
    ADD CONSTRAINT "streak_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sudokuGames sudokuGames_puzzleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."sudokuGames"
    ADD CONSTRAINT "sudokuGames_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES public.puzzles(id) ON DELETE CASCADE;


--
-- Name: user_achievements user_achievements_achievementId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES public.achievements(id) ON DELETE CASCADE;


--
-- Name: user_achievements user_achievements_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_calendars user_calendars_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_calendars
    ADD CONSTRAINT "user_calendars_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: user_google_tokens user_google_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_google_tokens
    ADD CONSTRAINT user_google_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: user_inventory user_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.shop_items(id);


--
-- Name: user_inventory user_inventory_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_streaks user_streaks_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_streaks
    ADD CONSTRAINT "user_streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_group_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_group_fk FOREIGN KEY ("groupId") REFERENCES public."familyGroups"(id) ON DELETE SET NULL;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: users Can update own user data.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Can update own user data." ON public.users FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: users Can view own user data.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Can view own user data." ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: push_tokens Users can delete their own push tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own push tokens" ON public.push_tokens FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: device_tokens Users can insert their own device tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own device tokens" ON public.device_tokens FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: push_tokens Users can insert their own push tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own push tokens" ON public.push_tokens FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: streak_history Users can manage their own streak history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own streak history" ON public.streak_history USING ((auth.uid() = "userId")) WITH CHECK ((auth.uid() = "userId"));


--
-- Name: user_streaks Users can manage their own streaks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own streaks" ON public.user_streaks USING ((auth.uid() = "userId")) WITH CHECK ((auth.uid() = "userId"));


--
-- Name: device_tokens Users can update their own device tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own device tokens" ON public.device_tokens FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: push_tokens Users can update their own push tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own push tokens" ON public.push_tokens FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: activities Users can view activities from their family group; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view activities from their family group" ON public.activities FOR SELECT USING (public.is_same_family_group("createdBy"));


--
-- Name: streak_history Users can view streak history from their family group; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view streak history from their family group" ON public.streak_history FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.users u1,
    public.users u2
  WHERE ((u1.id = auth.uid()) AND (u2.id = streak_history."userId") AND (u1."groupId" = u2."groupId") AND (u1."groupId" IS NOT NULL)))) OR (auth.uid() = "userId")));


--
-- Name: user_streaks Users can view streaks from their family group; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view streaks from their family group" ON public.user_streaks FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.users u1,
    public.users u2
  WHERE ((u1.id = auth.uid()) AND (u2.id = user_streaks."userId") AND (u1."groupId" = u2."groupId") AND (u1."groupId" IS NOT NULL)))) OR (auth.uid() = "userId")));


--
-- Name: device_tokens Users can view their own device tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own device tokens" ON public.device_tokens FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: push_tokens Users can view their own push tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own push tokens" ON public.push_tokens FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_completions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_completions ENABLE ROW LEVEL SECURITY;

--
-- Name: attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: device_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: familyGroups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."familyGroups" ENABLE ROW LEVEL SECURITY;

--
-- Name: frequencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.frequencies ENABLE ROW LEVEL SECURITY;

--
-- Name: logicGames; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."logicGames" ENABLE ROW LEVEL SECURITY;

--
-- Name: memories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

--
-- Name: memoriesAlbumPages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."memoriesAlbumPages" ENABLE ROW LEVEL SECURITY;

--
-- Name: memoriesAlbums; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."memoriesAlbums" ENABLE ROW LEVEL SECURITY;

--
-- Name: memoriesBooks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."memoriesBooks" ENABLE ROW LEVEL SECURITY;

--
-- Name: memoryGames; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."memoryGames" ENABLE ROW LEVEL SECURITY;

--
-- Name: memory_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.memory_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: mentions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: point_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: push_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: puzzles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;

--
-- Name: shop_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

--
-- Name: streak_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.streak_history ENABLE ROW LEVEL SECURITY;

--
-- Name: sudokuGames; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."sudokuGames" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: user_calendars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_calendars ENABLE ROW LEVEL SECURITY;

--
-- Name: user_google_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: user_inventory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

--
-- Name: user_streaks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

