@echo off
title Gestao Familiar - Teste Local
cd /d "%~dp0.."
echo A iniciar Gestao Familiar (build dist)...
echo O browser vai abrir automaticamente. Fecha esta janela para parar o servidor.
node "node_modules\vite\bin\vite.js" preview --port 4173 --open
if errorlevel 1 pause
