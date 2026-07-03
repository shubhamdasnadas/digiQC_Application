--
-- PostgreSQL database dump
--

\restrict 2QUi2h7nJuKUpkcLvzY1Lage0n3wGz0voKgeuLRXhXKLwFyEUZ5MVV12tx5HgQd

-- Dumped from database version 18.4 (Homebrew)
-- Dumped by pg_dump version 18.4 (Homebrew)

-- Started on 2026-07-03 15:53:27 IST

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 319 (class 1259 OID 422876)
-- Name: checklist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checklist (
    checklist_name character varying(100)[],
    reference_number character varying(100)[],
    stage_name character varying(100)[],
    checkpoint character varying(500)[],
    yn text[],
    photo boolean[],
    remark boolean[]
);


ALTER TABLE public.checklist OWNER TO postgres;

-- Completed on 2026-07-03 15:53:28 IST

--
-- PostgreSQL database dump complete
--

\unrestrict 2QUi2h7nJuKUpkcLvzY1Lage0n3wGz0voKgeuLRXhXKLwFyEUZ5MVV12tx5HgQd

