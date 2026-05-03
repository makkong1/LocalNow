package com.localnow.common.monitoring;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.localnow.monitoringaoptest.MonitoringAopTestApplication;
import com.localnow.monitoringaoptest.service.EchoService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        classes = MonitoringAopTestApplication.class
)
class ServiceLayerMonitoringAspectTest {

    @Autowired
    private EchoService echoService;

    private final ListAppender<ILoggingEvent> listAppender = new ListAppender<>();
    private Logger aspectLogger;

    @BeforeEach
    void startCapturing() {
        aspectLogger = (Logger) LoggerFactory.getLogger(ServiceLayerMonitoringAspect.class);
        listAppender.start();
        aspectLogger.addAppender(listAppender);
    }

    @AfterEach
    void stopCapturing() {
        aspectLogger.detachAppender(listAppender);
    }

    @Test
    void publicServiceMethod_emitsMonitorLine() {
        echoService.run();

        assertThat(listAppender.list)
                .isNotEmpty()
                .anySatisfy(e -> assertThat(e.getFormattedMessage())
                        .contains("EchoService#run", "op=EchoService#run", "reason=SERVICE_MONITOR"));
    }
}
