import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.decompiler.DecompiledFunction;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import ghidra.program.model.symbol.Symbol;

import java.io.File;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Redo of the lost 2026-10-07 buzz-acp decompile, in one post-script:
 *  - dumps all functions whose name matches the messaging filter to candidate-names.txt
 *  - decompiles the 13 known addresses plus every name match into decompiled-targets.c
 * Args: <outDir>
 */
public class DecompileMessaging extends GhidraScript {

    private static final Pattern MESSAGING = Pattern.compile(
        "(?i)(steer|queue|interrupt|review|diff|approv|reject|permission|" +
        "session|prompt|heartbeat|pending|enqueue|publish|batch|stop|cancel|" +
        "dispatch|chunk|coalesc|observer|turn|followup|follow_up)");

    // addr -> friendly name applied by the original 2026-10-07 session
    private static final String[][] KNOWN_TARGETS = {
        { "0x10024ec18", "ObserverPublishQueue_ingest" },
        { "0x10024e374", "ObserverPublishQueue_next_frame" },
        { "0x1002547a8", "ObserverChunkCoalescer_push_pending" },
        { "0x10024a420", "batch_envelope" },
        { "0x10013f6ec", "handle_session_update" },
        { "0x10013c0a8", "build_acp_steer_params" },
        { "0x10013da64", "build_goose_steer_params" },
        { "0x10013b020", "StopReason_from_str" },
        { "0x100140fa0", "parse_prompt_response" },
        { "0x10024aa88", "dispatch_pending" },
        { "0x10024ca1c", "dispatch_heartbeat" },
        { "0x10011fb80", "send_steer" },
        { "0x100120434", "record_successful_steer" },
    };

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        File outDir = new File(args[0]);
        outDir.mkdirs();

        // 1. Candidate sweep over all functions
        List<Function> matches = new ArrayList<>();
        FunctionIterator it = currentProgram.getFunctionManager().getFunctions(true);
        while (it.hasNext()) {
            Function f = it.next();
            String name = f.getName();
            Symbol sym = f.getSymbol();
            String symName = sym != null ? sym.getName() : name;
            if (MESSAGING.matcher(name).find() || MESSAGING.matcher(symName).find()) {
                matches.add(f);
            }
        }

        File candidatesFile = new File(outDir, "candidate-names.txt");
        try (PrintWriter pw = new PrintWriter(candidatesFile, "UTF-8")) {
            for (Function f : matches) {
                Symbol sym = f.getSymbol();
                pw.println(f.getEntryPoint() + "\t" + f.getName() + "\t" +
                    (sym != null ? sym.getName() : ""));
            }
        }
        println("DUMPED " + matches.size() + " candidates -> " + candidatesFile);

        // 2. Decompile set: 13 known targets first, then name matches (dedup)
        Set<Function> targets = new LinkedHashSet<>();
        List<String> knownLabels = new ArrayList<>();
        for (String[] kt : KNOWN_TARGETS) {
            Address addr = currentProgram.getAddressFactory().getAddress(kt[0]);
            Function f = getFunctionAt(addr);
            if (f == null) {
                f = getFunctionContaining(addr);
            }
            if (f != null) {
                targets.add(f);
                knownLabels.add(kt[1] + "@" + kt[0]);
            } else {
                println("WARN: no function at " + kt[0] + " (" + kt[1] + ")");
            }
        }
        for (Function f : matches) {
            if (targets.size() >= 100) {
                break;
            }
            targets.add(f);
        }

        // 3. Decompile everything in the set
        DecompInterface di = new DecompInterface();
        di.openProgram(currentProgram);
        File outFile = new File(outDir, "decompiled-targets.c");
        int written = 0;
        try (PrintWriter pw = new PrintWriter(outFile, "UTF-8")) {
            pw.println("/* decompiled-targets.c — buzz-acp (arm64, sha256");
            pw.println(" * 2356ed0661a1ad0b5641ad09bdaed52d9285cf21913464c3f6ec37be9b57197c)");
            pw.println(" * Regenerated 2026-10-08 after the 2026-10-07 outputs were lost in the");
            pw.println(" * campaign-evidence move. Known-target labels from the surviving logs.");
            pw.println(" * Known targets resolved: " + knownLabels.size() + "/13 -> " + knownLabels);
            pw.println(" */");
            for (Function f : targets) {
                DecompileResults res = di.decompileFunction(f, 120, monitor);
                if (res == null || !res.decompileCompleted()) {
                    println("WARN: decompile failed at " + f.getEntryPoint() + " " + f.getName());
                    continue;
                }
                DecompiledFunction df = res.getDecompiledFunction();
                String c = df.getC();
                // Annotate the 13 known targets with their original labels
                String note = "";
                for (String[] kt : KNOWN_TARGETS) {
                    if (f.getEntryPoint().toString().equals(kt[0].replace("0x", ""))) {
                        note = " [2026-10-07 label: " + kt[1] + "]";
                    }
                }
                pw.println();
                pw.println("// ==== " + f.getEntryPoint() + "  " + f.getName() + note + " ====");
                pw.print(c);
                written++;
            }
        }
        di.dispose();
        println("WROTE " + written + "/" + targets.size() + " functions -> " + outFile);
    }
}
