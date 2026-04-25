package com.localnow.monitoringaoptest;

import com.localnow.common.monitoring.ServiceLayerMonitoringAspect;
import com.localnow.monitoringaoptest.service.EchoService;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.context.annotation.Import;

@SpringBootConfiguration
@EnableAspectJAutoProxy
@Import({ServiceLayerMonitoringAspect.class, EchoService.class})
public class MonitoringAopTestApplication {}
