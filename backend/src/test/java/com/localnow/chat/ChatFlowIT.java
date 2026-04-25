package com.localnow.chat;

import com.localnow.chat.domain.ChatRoom;
import com.localnow.chat.dto.ChatMessageRequest;
import com.localnow.chat.dto.ChatMessageResponse;
import com.localnow.chat.repository.ChatMessageRepository;
import com.localnow.chat.repository.ChatRoomRepository;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.domain.RequestType;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.user.domain.User;
import com.localnow.user.domain.UserRole;
import com.localnow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.lang.reflect.Type;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers(disabledWithoutDocker = true)
class ChatFlowIT {

    @Container
    static MySQLContainer<?> mysql = new MySQLContainer<>(DockerImageName.parse("mysql:8.0"))
            .withDatabaseName("localnow")
            .withUsername("test")
            .withPassword("test");

    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @Container
    static RabbitMQContainer rabbit = new RabbitMQContainer(
            DockerImageName.parse("rabbitmq:3-management-alpine"));

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", mysql::getJdbcUrl);
        registry.add("spring.datasource.username", mysql::getUsername);
        registry.add("spring.datasource.password", mysql::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        registry.add("spring.rabbitmq.host", rabbit::getHost);
        registry.add("spring.rabbitmq.port", () -> rabbit.getMappedPort(5672));
    }

    @LocalServerPort int port;

    @Autowired UserRepository userRepository;
    @Autowired HelpRequestRepository helpRequestRepository;
    @Autowired ChatRoomRepository chatRoomRepository;
    @Autowired ChatMessageRepository chatMessageRepository;

    @AfterEach
    void cleanup() {
        chatMessageRepository.deleteAll();
        chatRoomRepository.deleteAll();
        helpRequestRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void stomp_message_broadcast_reaches_subscriber() throws Exception {
        User traveler = createUser("t@test.com", "Traveler", UserRole.TRAVELER);
        User guide = createUser("g@test.com", "Guide", UserRole.GUIDE);
        HelpRequest request = createRequest(traveler.getId());

        ChatRoom room = new ChatRoom();
        room.setRequestId(request.getId());
        room.setTravelerId(traveler.getId());
        room.setGuideId(guide.getId());
        room = chatRoomRepository.save(room);
        Long roomId = room.getId();

        BlockingQueue<ChatMessageResponse> received = new LinkedBlockingQueue<>();

        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new MappingJackson2MessageConverter());

        String url = "ws://localhost:" + port + "/ws/websocket";
        StompSession session = client.connectAsync(url, new WebSocketHttpHeaders(),
                new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        session.subscribe("/topic/rooms/" + roomId,
                new StompFrameHandler() {
                    @Override
                    public Type getPayloadType(StompHeaders headers) { return ChatMessageResponse.class; }

                    @Override
                    public void handleFrame(StompHeaders headers, Object payload) {
                        received.add((ChatMessageResponse) payload);
                    }
                });

        String clientMessageId = UUID.randomUUID().toString();
        session.send("/app/rooms/" + roomId + "/messages",
                new ChatMessageRequest("Hello from STOMP", clientMessageId));

        ChatMessageResponse msg = received.poll(5, TimeUnit.SECONDS);
        assertThat(msg).isNotNull();
        assertThat(msg.content()).isEqualTo("Hello from STOMP");
        assertThat(msg.senderId()).isNotNull();

        session.disconnect();
        client.stop();
    }

    private User createUser(String email, String name, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setPassword("$2a$10$dummyhashfortest000000000000000000000000000000000000000");
        user.setName(name);
        user.setRole(role);
        return userRepository.save(user);
    }

    private HelpRequest createRequest(Long travelerId) {
        HelpRequest r = new HelpRequest();
        r.setTravelerId(travelerId);
        r.setRequestType(RequestType.GUIDE);
        r.setLat(37.5665);
        r.setLng(126.9780);
        r.setDescription("Test");
        r.setStartAt(LocalDateTime.now().plusHours(1));
        r.setDurationMin(60);
        r.setBudgetKrw(10000L);
        r.setStatus(HelpRequestStatus.OPEN);
        return helpRequestRepository.save(r);
    }
}
