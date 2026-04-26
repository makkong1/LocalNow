package com.localnow.config.rabbit;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_NAME = "localnow.topic";
    public static final String MATCH_QUEUE = "match.notification";
    public static final String CHAT_QUEUE = "chat.notification";

    @Bean
    public TopicExchange topicExchange() {
        return new TopicExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    public Queue matchNotificationQueue() {
        return new Queue(MATCH_QUEUE, true);
    }

    @Bean
    public Queue chatNotificationQueue() {
        return new Queue(CHAT_QUEUE, true);
    }

    @Bean
    public Binding matchBinding() {
        return BindingBuilder.bind(matchNotificationQueue()).to(topicExchange()).with("match.*");
    }

    @Bean
    public Binding chatBinding() {
        return BindingBuilder.bind(chatNotificationQueue()).to(topicExchange()).with("chat.*");
    }
}
