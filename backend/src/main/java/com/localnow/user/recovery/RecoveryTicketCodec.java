package com.localnow.user.recovery;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class RecoveryTicketCodec {

    private final ObjectMapper mapper = new ObjectMapper();

    public String serialize(RecoveryTicket ticket) {
        try {
            return mapper.writeValueAsString(ticket);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    public RecoveryTicket deserialize(String json) {
        try {
            return mapper.readValue(json, RecoveryTicket.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
