package com.localnow.infra.translator;

public interface Translator {
    String translate(String text, String sourceLang, String targetLang);
}
