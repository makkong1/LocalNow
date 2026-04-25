package com.localnow.infra.translator;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Primary
@Component
public class PassThroughTranslator implements Translator {

    @Override
    public String translate(String text, String sourceLang, String targetLang) {
        return text;
    }
}
